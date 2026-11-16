-- Incidents: real clearance tracking + AI learning metadata
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS cleared_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_reference_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_source text;

UPDATE public.incidents SET cleared_at = updated_at WHERE status = 'cleared' AND cleared_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_incident_cleared_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cleared' AND OLD.status IS DISTINCT FROM 'cleared' THEN
    NEW.cleared_at := now();
  ELSIF NEW.status = 'active' THEN
    NEW.cleared_at := NULL;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER incidents_set_cleared_at BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_incident_cleared_at();

CREATE INDEX IF NOT EXISTS incidents_type_status_idx ON public.incidents (type, status);

-- Live traffic on main corridors (cached Google data)
CREATE TABLE public.traffic_corridors (
  id text PRIMARY KEY,
  name text NOT NULL,
  encoded_polyline text NOT NULL DEFAULT '',
  distance_m integer NOT NULL DEFAULT 0,
  duration_s integer NOT NULL DEFAULT 0,
  static_duration_s integer NOT NULL DEFAULT 0,
  speed_intervals jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.traffic_corridors TO anon, authenticated;
GRANT ALL ON public.traffic_corridors TO service_role;
ALTER TABLE public.traffic_corridors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read live traffic" ON public.traffic_corridors FOR SELECT TO anon, authenticated USING (true);

-- Refresh lock so only one request refreshes Google data per 15 minutes
CREATE TABLE public.traffic_refresh_lock (
  id integer PRIMARY KEY,
  locked_until timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.traffic_refresh_lock TO service_role;
ALTER TABLE public.traffic_refresh_lock ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_traffic_refresh(_max_age_seconds integer DEFAULT 900)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE newest timestamptz; claimed boolean := false;
BEGIN
  SELECT max(updated_at) INTO newest FROM public.traffic_corridors;
  IF newest IS NOT NULL AND newest > now() - make_interval(secs => _max_age_seconds) THEN
    RETURN false;
  END IF;
  INSERT INTO public.traffic_refresh_lock (id, locked_until) VALUES (1, now() + interval '90 seconds')
  ON CONFLICT (id) DO UPDATE SET locked_until = EXCLUDED.locked_until
    WHERE public.traffic_refresh_lock.locked_until < now()
  RETURNING true INTO claimed;
  RETURN COALESCE(claimed, false);
END; $$;
REVOKE EXECUTE ON FUNCTION public.claim_traffic_refresh(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_traffic_refresh(integer) TO service_role;