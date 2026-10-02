-- Lumen Books — catalogue de démonstration
--
-- À exécuter APRÈS `0000_init.sql`, dans l'éditeur SQL de Supabase
-- (ou `psql`). Le script est idempotent : `on conflict do nothing`, donc
-- le relancer ne touche pas aux fiches que vous avez déjà éditées.
--
-- Ces livres sont des DEMOS (`is_demo = true`) : ils n'ont ni couverture ni
-- PDF. Ils restent donc visibles sur la boutique pour que le catalogue, les
-- filtres et les fiches ne soient pas vides, mais le checkout les refuse
-- (`book_no_file`) tant que le fichier n'a pas été téléversé.

-- ---------------------------------------------------------------------------
-- Catégories
-- ---------------------------------------------------------------------------
insert into public.categories (slug, name_en, name_fr, name_ar, description_en, description_fr, description_ar, position)
values
  ('fiction', 'Fiction', 'Fiction', 'رواية', 'Stories that stay with you.', 'Des histoires qui restent.', 'حكايات تبقى معك.', 1),
  ('business', 'Business', 'Business', 'أعمال', 'Money, management and work.', 'Argent, gestion et travail.', 'مال وإدارة وعمل.', 2),
  ('technology', 'Technology', 'Technologie', 'تقنية', 'Software, craft and the web.', 'Logiciel, artisanat et web.', 'برمجيات وحرفية ويب.', 3),
  ('self-help', 'Personal growth', 'Développement personnel', 'تطوير الذات', 'Habits, focus and wellbeing.', 'Habitudes, focus et bien-être.', 'عادات وتركيز ورفاه.', 4),
  ('history', 'History', 'Histoire', 'تاريخ', 'The past, told carefully.', 'Le passé, bien raconté.', 'الماضي، رواية متقنة.', 5)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Livres (démo, sans fichier)
-- ---------------------------------------------------------------------------
insert into public.books
  (slug, title, subtitle, author, description, excerpt, category_id, price_cents, compare_at_cents,
   language, formats, pages, published_at, is_featured, is_active, is_demo)
select
  v.slug, v.title, v.subtitle, v.author, v.description, v.excerpt, c.id,
  v.price_cents, v.compare_at_cents, v.language, v.formats, v.pages, v.published_at::date,
  v.is_featured, true, true
from (values
  ('the-quiet-cartographer', 'The Quiet Cartographer',
   'Mapping a world that keeps moving', 'Amara Haddad',
   'A fictional debut about a mapmaker who charts coastlines that no longer exist. Written to show how a long-form description sits next to the buy box, the specifications table and the excerpt.',
   'The first line she ever drew was wrong, and she has been correcting maps ever since.',
   'fiction', 1290, 1690, 'en', array['epub','pdf']::text[], 284, '2025-03-11', true),

  ('the-glass-orchard', 'The Glass Orchard',
   'A novel in seven seasons', 'Tomás Iglesias',
   'A family runs an orchard under glass. Seven seasons, seven letters, one diagnosis. A sample record used to exercise long titles, subtitles and multi-sentence descriptions.',
   'In the first season, everything was still possible and the frost came late.',
   'fiction', 990, null, 'en', array['epub']::text[], 212, '2025-06-02', true),

  ('قصة قصيرة', 'Short Stories, Slowly',
   'دورة قصص', 'ليلى بن عمار',
   'A fictional bilingual collection used to check the right-to-left layout, the Arabic cover metadata and mixed-language catalogues.',
   'كل قصة تبدأ بباب مغلق ينفتح ببطء.',
   'fiction', 790, 990, 'ar', array['epub','pdf']::text[], 168, '2025-01-20', false),

  ('the-zero-to-one-handbook', 'The Zero to One Handbook',
   'Notes from a small team', 'Daniel Okonkwo',
   'How a six-person company goes from nothing to paying customers. A practical-looking record with numbered steps, used to show bullet lists inside the description.',
   'Revenue is a lagging indicator. Customer conversations are the leading one.',
   'business', 1590, 1990, 'en', array['epub','pdf']::text[], 246, '2025-04-08', true),

  ('pricing-for-people-who-hate-pricing', 'Pricing for People Who Hate Pricing',
   null, 'Sofia Lindqvist',
   'A short, opinionated guide to setting a price and then not moving it. Demo record with no subtitle, to confirm the layout holds when a field is empty.',
   'Raise your price before you raise your volume. In that order.',
   'business', 890, null, 'en', array['epub']::text[], 132, '2025-09-15', false),

  ('ship-it', 'Ship It',
   'Small software, real users', 'Ravi Menon',
   'A fictional engineering manual about the last mile: staging, rollback, and telling users what changed. Used to show a technical record with an ISBN.',
   'A deploy is a promise. Keep the rollback plan before the release plan.',
   'technology', 1790, 2190, 'en', array['epub','pdf']::text[], 312, '2025-02-27', true),

  ('the-quiet-database', 'The Quiet Database',
   'Indexing, migrations and patience', 'Nora Vasquez',
   'Schema changes, explained without drama. Demo record with a long tail of specifications to fill the technical table.',
   'Most production incidents are a migration that was tested on an empty database.',
   'technology', 1390, null, 'en', array['epub','pdf']::text[], 198, '2025-07-19', false),

  ('interfaces-for-humans', 'Interfaces for Humans',
   'Tendering accessibility', 'Chloé Marchand',
   'A French-language edition of an accessibility primer: labels, focus order, and the cost of an unlabelled icon.',
   'Une icône sans étiquette est une énigme, pas une icône.',
   'technology', 1190, 1490, 'fr', array['epub','pdf']::text[], 174, '2025-05-30', false),

  ('the-quiet-morning', 'The Quiet Morning',
   'Thirty days of attention', 'Hana Sato',
   'A gentle thirty-day practice around attention, sleep and screens. Demo record used to show the newest-releases ordering.',
   'Le café était froid depuis longtemps. Je n''avais pas envie de le réchauffer.',
   'self-help', 690, 890, 'fr', array['epub']::text[], 118, '2025-11-04', false),

  ('focus-is-a-skill', 'Focus Is a Skill',
   'Train it like a muscle', 'Marcus Bell',
   'Where attention goes, the day goes. A short record that reads well on a phone, used to check the mobile buy box.',
   'Attention is not a personality trait. It is a capacity, and capacities respond to training.',
   'self-help', 590, null, 'en', array['epub']::text[], 104, '2026-01-22', false),

  ('the-cartographers-tale', 'The Cartographer''s Tale',
   'Two centuries of maps', 'Elena Ruiz',
   'How borders were drawn, redrawn and remembered. A historical record with a long title and a subtitle, used to check wrapping in three languages.',
   'Every border is an argument that someone eventually stopped having.',
   'history', 1390, 1790, 'en', array['epub','pdf']::text[], 356, '2024-10-01', true),

  ('des-livres-et-des-lisieres', 'Des livres et des lisières',
'Petite histoire de l''édition', 'Yann Le Goff',
    'Une histoire courte de l''édition et des ateliers qui font le papier. Enregistrements de démonstration pour vérifier la mise en page des accents.',
   'Le papier se choisissait à l''oreille avant de se choisir au prix.',
   'history', 990, null, 'fr', array['epub']::text[], 190, '2025-08-09', false)
) as v(slug, title, subtitle, author, description, excerpt, category, price_cents, compare_at_cents, language, formats, pages, published_at, is_featured)
join public.categories c on c.slug = v.category
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Code promo de bienvenue
-- ---------------------------------------------------------------------------
insert into public.promo_codes
  (code, kind, value, min_subtotal_cents, max_uses, used_count, starts_at, expires_at, is_active)
values ('WELCOME10', 'percent', 10, 1000, 100, 0, now() - interval '1 day', now() + interval '180 days', true)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Contrôle : doit renvoyer les livres de démonstration insérés
-- ---------------------------------------------------------------------------
select count(*) as demo_books from public.books where is_demo;
