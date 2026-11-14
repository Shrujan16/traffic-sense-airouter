-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- INCIDENTS
CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  is_anonymous boolean NOT NULL DEFAULT false,
  type text NOT NULL CHECK (type IN ('accident','breakdown','construction','signal_failure','roadblock')),
  description text NOT NULL DEFAULT '',
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  location_name text NOT NULL DEFAULT 'Unknown location',
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  estimated_delay integer NOT NULL DEFAULT 10,
  estimated_clearance integer NOT NULL DEFAULT 30,
  ai_likely_cause text,
  ai_explanation text,
  ai_advice text,
  image_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cleared')),
  still_there_count integer NOT NULL DEFAULT 0,
  cleared_count integer NOT NULL DEFAULT 0,
  upvotes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX incidents_created_at_idx ON public.incidents (created_at DESC);
GRANT SELECT ON public.incidents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read incidents" ON public.incidents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Signed-in users report incidents" ON public.incidents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update incidents" ON public.incidents FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete incidents" ON public.incidents FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Owners may not tamper with community counters
CREATE OR REPLACE FUNCTION public.protect_incident_counters()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('app.counter_update', true) IS DISTINCT FROM 'on' THEN
    NEW.still_there_count := OLD.still_there_count;
    NEW.cleared_count := OLD.cleared_count;
    NEW.upvotes := OLD.upvotes;
    NEW.user_id := OLD.user_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER incidents_protect_counters BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.protect_incident_counters();

-- VOTES
CREATE TABLE public.incident_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  vote_type text NOT NULL CHECK (vote_type IN ('still_there','cleared','upvote')),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- one status vote (still_there / cleared) and one upvote per user per incident
CREATE UNIQUE INDEX incident_votes_status_unique ON public.incident_votes (incident_id, user_id) WHERE vote_type IN ('still_there','cleared');
CREATE UNIQUE INDEX incident_votes_upvote_unique ON public.incident_votes (incident_id, user_id) WHERE vote_type = 'upvote';
GRANT SELECT, INSERT, DELETE ON public.incident_votes TO authenticated;
GRANT ALL ON public.incident_votes TO service_role;
ALTER TABLE public.incident_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own votes" ON public.incident_votes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add own votes" ON public.incident_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own votes" ON public.incident_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.refresh_incident_counts(_incident_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s int; c int; u int;
BEGIN
  SELECT count(*) FILTER (WHERE vote_type='still_there'),
         count(*) FILTER (WHERE vote_type='cleared'),
         count(*) FILTER (WHERE vote_type='upvote')
    INTO s, c, u FROM public.incident_votes WHERE incident_id = _incident_id;
  PERFORM set_config('app.counter_update', 'on', true);
  UPDATE public.incidents SET
    still_there_count = s, cleared_count = c, upvotes = u,
    status = CASE WHEN c >= 3 AND c > s THEN 'cleared' WHEN status = 'cleared' AND s > c THEN 'active' ELSE status END
  WHERE id = _incident_id;
  PERFORM set_config('app.counter_update', 'off', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.refresh_incident_counts(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.on_vote_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.refresh_incident_counts(COALESCE(NEW.incident_id, OLD.incident_id));
  RETURN NULL;
END; $$;
CREATE TRIGGER incident_votes_refresh AFTER INSERT OR DELETE ON public.incident_votes FOR EACH ROW EXECUTE FUNCTION public.on_vote_change();

-- Toggle a vote for the current user. Status votes replace each other.
CREATE OR REPLACE FUNCTION public.cast_vote(_incident_id uuid, _vote_type text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); existed boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to vote'; END IF;
  IF _vote_type NOT IN ('still_there','cleared','upvote') THEN RAISE EXCEPTION 'Invalid vote'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.incident_votes WHERE incident_id=_incident_id AND user_id=uid AND vote_type=_vote_type) INTO existed;
  IF existed THEN
    DELETE FROM public.incident_votes WHERE incident_id=_incident_id AND user_id=uid AND vote_type=_vote_type;
    RETURN 'removed';
  END IF;
  IF _vote_type IN ('still_there','cleared') THEN
    DELETE FROM public.incident_votes WHERE incident_id=_incident_id AND user_id=uid AND vote_type IN ('still_there','cleared');
  END IF;
  INSERT INTO public.incident_votes (incident_id, user_id, vote_type) VALUES (_incident_id, uid, _vote_type);
  RETURN 'added';
END; $$;
REVOKE EXECUTE ON FUNCTION public.cast_vote(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cast_vote(uuid, text) TO authenticated;

-- STORAGE policies for incident-images (bucket created separately)
CREATE POLICY "Public read incident images" ON storage.objects FOR SELECT USING (bucket_id = 'incident-images');
CREATE POLICY "Users upload own incident images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'incident-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own incident images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'incident-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- REALTIME
ALTER TABLE public.incidents REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;

-- SEED: 15 incidents across Bengaluru
INSERT INTO public.incidents (type, description, lat, lng, location_name, severity, estimated_delay, estimated_clearance, ai_likely_cause, ai_explanation, ai_advice, status, still_there_count, cleared_count, upvotes, created_at) VALUES
('signal_failure','Signals at the junction are blinking amber in all directions. Traffic police not yet on site.',12.9172,77.6229,'Silk Board Junction','high',35,60,'Traffic signal outage at a major junction','The traffic lights at Silk Board are not working, so vehicles from all four directions are trying to cross at once. Without signals or police control, the junction locks up and queues spill back onto Hosur Road and the Outer Ring Road.','Avoid Silk Board for the next hour. Use HSR Layout 27th Main or Bannerghatta Road if heading south.','active',14,1,22, now() - interval '12 minutes'),
('accident','Two cars and a bike collided on the flyover, left lane blocked towards the airport.',13.0358,77.5970,'Hebbal Flyover','high',30,45,'Multi-vehicle collision blocking a lane','A collision on the Hebbal flyover has blocked the left lane heading towards the airport. Traffic is squeezing into the remaining lanes, and onlookers slowing down are making the backup longer.','Take the service road below the flyover or use Thanisandra Main Road towards the airport.','active',9,0,17, now() - interval '25 minutes'),
('construction','Metro pillar work has narrowed the road to one lane near Marathahalli bridge.',12.9569,77.7011,'Outer Ring Road, Marathahalli','medium',20,240,'Metro construction narrowing the carriageway','Ongoing metro construction near the Marathahalli bridge has reduced the road to a single lane. Every vehicle has to merge into that lane, which slows the whole stretch, especially at peak hours.','Leave 20 minutes early or use Varthur Road via Kundalahalli Gate.','active',11,0,13, now() - interval '2 hours'),
('breakdown','A BMTC bus has broken down in the middle lane on the bridge.',13.0050,77.6960,'KR Puram Bridge','medium',18,40,'Broken-down bus blocking the middle lane','A city bus has broken down on the KR Puram bridge and is blocking the middle lane. Vehicles have to change lanes around it on a narrow bridge, causing a slow crawl in both directions.','Expect a short crawl; use Old Madras Road via Tin Factory only if it is clear.','active',6,1,8, now() - interval '40 minutes'),
('roadblock','Police barricades placed for a VIP movement; one carriageway closed.',12.8452,77.6602,'Electronic City Phase 1','high',28,50,'Police barricades for a VIP convoy','Police have closed one side of the road near Electronic City for a VIP convoy. All traffic is being diverted into the other carriageway, which cannot handle the extra volume.','Use the Electronic City elevated tollway or wait 30–45 minutes for the closure to lift.','active',7,0,10, now() - interval '18 minutes'),
('breakdown','Car with flat tyre near Trinity metro station, now moved to the side.',12.9730,77.6170,'MG Road, Trinity Circle','low',5,15,'Stalled car near metro station','A car had a flat tyre near Trinity Circle and briefly blocked a lane. It has now been pushed to the side, and traffic is returning to normal.','No major change needed; minor slowdown only.','cleared',1,4,3, now() - interval '3 hours'),
('signal_failure','Signal timer stuck on red for the Koramangala side.',12.9366,77.6265,'Sony World Junction, Koramangala','medium',15,30,'Signal stuck on red for one approach','The signal at Sony World Junction is stuck on red for traffic coming from Koramangala. Cars on that side cannot move while other directions flow, so a long queue is forming.','Use 80 Feet Road via Forum Mall junction instead.','active',5,0,6, now() - interval '35 minutes'),
('construction','Road widening and drainage work near Tin Factory. Heavy equipment on the road.',12.9965,77.6680,'Tin Factory, Old Madras Road','high',32,300,'Road widening and drainage works','Road widening and drainage work near Tin Factory has heavy machinery occupying part of the road. Buses stopping nearby add to the congestion, making this one of the slowest stretches today.','Use the metro from Baiyappanahalli or approach via Banaswadi Main Road.','active',12,0,15, now() - interval '5 hours'),
('accident','Auto rickshaw overturned near Ecospace, ambulance on the way.',12.9260,77.6762,'Bellandur, Outer Ring Road','medium',22,35,'Overturned auto-rickshaw','An auto-rickshaw has overturned on the Outer Ring Road near Ecospace. Emergency vehicles are arriving, and one lane is blocked while the scene is cleared.','Use Sarjapur Road via Iblur if possible; delays should ease in about 30 minutes.','active',4,0,5, now() - interval '50 minutes'),
('roadblock','Religious procession moving towards the temple; road partially closed.',13.0285,77.5400,'Yeshwanthpur Circle','medium',20,60,'Procession occupying the road','A religious procession is moving slowly through Yeshwanthpur Circle and has closed part of the road. Traffic is being held at intervals to let the procession pass.','Use Tumkur Road service lanes or Mathikere Main Road.','active',3,0,4, now() - interval '1 hour 10 minutes'),
('accident','Minor fender bender between two cars, both drivers arguing on the road.',12.9420,77.5230,'Mysore Road, Nayandahalli','low',8,20,'Minor collision with vehicles stopped on road','Two cars had a minor collision and are still stopped in the lane while the drivers exchange details. The slowdown is short but noticeable at the junction.','Minor delay; stay in the right lane to pass.','active',2,1,2, now() - interval '20 minutes'),
('construction','Footpath and cable laying work, one lane closed in the evening.',12.9840,77.7500,'Hope Farm Junction, Whitefield','low',10,180,'Utility cable-laying work','Workers are laying cables along the roadside near Hope Farm, closing one lane. The slowdown is mild outside peak hours but can grow in the evening rush.','Plan for a 10-minute delay or use ITPL Main Road.','active',3,0,3, now() - interval '7 hours'),
('breakdown','Truck with engine trouble stopped at the bus stand entry.',12.9180,77.5730,'Banashankari Bus Stand','medium',15,45,'Broken-down truck at bus stand entry','A truck with engine trouble is stuck at the entry to the Banashankari bus stand. Buses cannot turn in easily, so they are waiting on the main road and blocking traffic.','Use Kanakapura Road via Yelachenahalli to bypass the bus stand.','active',5,0,4, now() - interval '1 hour 30 minutes'),
('signal_failure','Pedestrian signal malfunctioning, causing confusion at the crossing.',12.9719,77.6412,'100 Feet Road, Indiranagar','low',7,25,'Pedestrian signal malfunction','The pedestrian signal on 100 Feet Road is malfunctioning, so walkers are crossing at random times. Drivers have to stop unexpectedly, causing stop-and-go traffic.','Drive carefully; delay is minor.','active',2,0,2, now() - interval '9 hours'),
('accident','Two-wheeler hit by a cab near Bommanahalli signal, rider injured.',12.9020,77.6230,'Hosur Road, Bommanahalli','high',25,40,'Collision with injured rider','A cab and a two-wheeler collided near the Bommanahalli signal and the rider is injured. Police and an ambulance have closed one lane, and traffic from Silk Board is backing up.','Avoid Hosur Road northbound; use Begur Road or the Electronic City tollway.','active',8,0,11, now() - interval '15 hours');