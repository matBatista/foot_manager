DELETE FROM players  WHERE team_id IN (SELECT id FROM teams WHERE division = 'serie_b');
DELETE FROM teams    WHERE division = 'serie_b';
