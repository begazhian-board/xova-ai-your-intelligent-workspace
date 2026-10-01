CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own conversations" ON public.conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX conversations_user_updated ON public.conversations (user_id, updated_at DESC);
ALTER TABLE public.messages ADD COLUMN conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE;
CREATE INDEX messages_conversation ON public.messages (conversation_id, created_at);
INSERT INTO public.conversations (id, user_id, title, created_at, updated_at)
SELECT gen_random_uuid(), m.user_id, p.conversation_title, min(m.created_at), max(m.created_at)
FROM public.messages m LEFT JOIN public.profiles p ON p.id = m.user_id GROUP BY m.user_id, p.conversation_title;
UPDATE public.messages m SET conversation_id = c.id FROM public.conversations c WHERE c.user_id = m.user_id AND m.conversation_id IS NULL;
COMMENT ON COLUMN public.profiles.conversation_title IS 'DEPRECATED: replaced by conversations.title';