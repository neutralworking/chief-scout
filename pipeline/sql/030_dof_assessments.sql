-- 030_dof_assessments.sql — Director of Football structured assessments
--
-- Multi-dimensional assessment (6 pillars × 1-10 scale) with narrative,
-- two-tier valuation, and confidence levels.
-- Feeds into valuation engine as DOF_ANCHOR mode (highest-trust input).

CREATE TABLE IF NOT EXISTS dof_assessments (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    person_id       bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,

    -- 6 dimension scores (1-10, DoF-friendly scale)
    technical       smallint CHECK (technical BETWEEN 1 AND 10),
    physical        smallint CHECK (physical BETWEEN 1 AND 10),
    tactical        smallint CHECK (tactical BETWEEN 1 AND 10),
    personality     smallint CHECK (personality BETWEEN 1 AND 10),
    commercial      smallint CHECK (commercial BETWEEN 1 AND 10),
    availability    smallint CHECK (availability BETWEEN 1 AND 10),

    -- Per-dimension narrative (the reasoning)
    technical_note  text,
    physical_note   text,
    tactical_note   text,
    personality_note text,
    commercial_note text,
    availability_note text,

    -- Two-tier valuation (millions EUR)
    worth_right_team_meur  numeric(7,1),  -- "200m to the right team"
    worth_any_team_meur    numeric(7,1),  -- "100m to any team"

    -- Usage profile + summary
    usage_profile   text,     -- "Must-win situations, carry in attack, team carries on defence"
    summary         text,     -- Overall narrative

    -- DoF confidence
    confidence      text NOT NULL DEFAULT 'informed'
                    CHECK (confidence IN ('conviction', 'informed', 'impression')),

    -- Metadata
    is_current      boolean DEFAULT true,
    assessed_at     timestamptz DEFAULT now(),
    created_at      timestamptz DEFAULT now()
);

-- One active assessment per player
CREATE UNIQUE INDEX IF NOT EXISTS idx_dof_current
    ON dof_assessments(person_id) WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_dof_person
    ON dof_assessments(person_id);

-- RLS
ALTER TABLE dof_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can read dof_assessments"
    ON dof_assessments FOR SELECT TO anon USING (true);

CREATE POLICY "service_role full access dof_assessments"
    ON dof_assessments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed: Messi
INSERT INTO dof_assessments (
    person_id, technical, physical, tactical, personality, commercial, availability,
    technical_note, physical_note, tactical_note, personality_note, commercial_note, availability_note,
    worth_right_team_meur, worth_any_team_meur,
    usage_profile, summary, confidence
) SELECT
    p.id, 10, 3, 10, 7, 10, 2,
    'Technically the best player in the history of the sport. Every touch, pass, dribble, and finish is at the absolute ceiling.',
    'Declining physically. Not available every game, cannot press, cannot sustain 90 minutes at high tempo. Needs to be managed.',
    'Genius. Plays anywhere across the front line. Creates, scores, orchestrates. Does not defend — team carries that burden.',
    'Self-centred artist. Will deliver in big moments but operates on his own terms. Not a dressing-room leader in the traditional sense.',
    'Superstar. Biggest commercial draw in football history. Shirt sales, sponsorships, global audience — off the charts.',
    'Only a PSG/MLS-tier club or Argentina can unlock him now. Too old and too expensive for most projects. Very limited market.',
    200.0, 100.0,
    'Must-win situations, creativity focus, team carries defensive burden',
    'The greatest player ever, but only deployable in very specific contexts. Worth 200m to the right team, 100m to any team.',
    'conviction'
FROM people p WHERE p.name = 'Lionel Messi' LIMIT 1;

-- Seed: Haaland
INSERT INTO dof_assessments (
    person_id, technical, physical, tactical, personality, commercial, availability,
    technical_note, physical_note, tactical_note, personality_note, commercial_note, availability_note,
    worth_right_team_meur, worth_any_team_meur,
    usage_profile, summary, confidence
) SELECT
    p.id, 7, 10, 4, 6, 5, 7,
    'Clinical finisher with power. Not a playmaker — limited first touch and passing range outside the box. Elite in the box.',
    'Physical monster. Pace, power, stamina, aerial dominance. One of the most physically gifted strikers ever.',
    'Limited tactical range. Needs service, needs a system built around him. Does not link play or press intelligently.',
    'Professional, competitive, but not a leader. Does his job, scores goals. Not a culture-setter.',
    'Growing brand but not yet a global icon. Big in Scandinavia, Premier League audience. Not Messi/Ronaldo tier commercially.',
    'Available to most top clubs. Young, fit, wants to win. Release clause dynamics may complicate.',
    150.0, 120.0,
    'Lead the line, penalty box dominance, aerial target, transition threat',
    'Elite goal machine. More universally valuable than Messi — any top team can use him. Worth 150m to the right team, 120m to any.',
    'conviction'
FROM people p WHERE p.name = 'Erling Haaland' LIMIT 1;
