-- Righe di prova, solo per controllare che tutto sia collegato bene.
-- Non sono prezzi veri — le sostituiamo con quelle vere dello scraper
-- appena colleghiamo anche quel pezzo.
--
-- Come usarlo: apri "SQL Editor" nel tuo progetto Supabase, incolla tutto
-- questo, premi "Run".

INSERT INTO cards (tcgdex_id, lang, name, name_en, set_name, set_code, local_id, rarity, image_url)
VALUES ('test-001', 'ja', 'テストカード', 'Test Card', 'Set di Prova', 'TEST', '1', 'RR', NULL);

INSERT INTO price_observations (tcgdex_id, source, source_card_id, grade_company, grade, price, currency, confirmed)
VALUES ('test-001', 'yuyu-tei', 'test-001', 'PSA', 10, 12345, 'JPY', false);
