"""Single source of truth for the film's timing, shared by vo_tts.py and mix.py.
composition.html carries the same numbers (beat grid B, origin T0)."""
B, T0 = 0.5333, 11.7            # music: 112.5 bpm, the drop (logo) lands on T0
beat = lambda n: T0 + n * B
DUR = 44.5

# (start, text[, speed factor])
VO = [
    (0.60,  "Your defense is tomorrow."),
    (3.40,  "Would you be ready?"),
    (6.50,  "Months of research. Five chapters."),
    (8.80,  "Scattered everywhere."),
    (12.35, "Academia Scribes brings it all together."),
    (14.90, "Upload your chapters,"),
    (16.10, "and they become your private knowledge base."),
    (19.10, "Ask anything about your project,"),
    (21.20, "and get answers from your own work, with the source."),
    (24.50, "Turn every chapter into flashcards and quizzes."),
    (28.70, "Face the questions your panel will ask,"),
    (30.90, "and know exactly how ready you are."),
    (beat(40),   "Understand it."),
    (beat(42), "Remember it."),
    (beat(44),   "Practice it."),
    (beat(46), "Defend it."),
    (37.75, "Academia Scribes."),
    (39.30, "Walk into your defense with clarity."),
]
