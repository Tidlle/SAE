// Projeto Supabase que recebe os eventos de uso (ver supabase/sae_tracking.sql).
// A chave "anon" é pública por natureza: só consegue INSERIR em sae_events (nada é lido com ela).
// Nunca coloque aqui a chave "service_role": ela fica nas Propriedades do Apps Script.
// Com os dois valores vazios, o rastreamento fica desligado.
export const TRACKER_URL = 'https://jbsjqqhshxzgdrzcazsw.supabase.co';
export const TRACKER_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impic2pxcWhzaHh6Z2RyemNhenN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzMxNTEsImV4cCI6MjEwODYwOTE1MX0.mvjfX1t6AKxO_nQYJNpvJgSmSesf7CfcpEuiwMEKqLc';
