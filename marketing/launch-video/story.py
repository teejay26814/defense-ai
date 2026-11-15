"""Single source of truth for the film's timing, shared by vo_tts.py and mix.py.
composition.html carries the same numbers (beat grid B, origin T0)."""
B, T0 = 0.5333, 11.7            # music: 112.5 bpm, the drop (logo) lands on T0
beat = lambda n: T0 + n * B
DUR = 44.5

# (start, text[, speed factor])
VO = [
    (0.60,  "Your defense is tomorrow."),
    (3.40,  "Would you be ready?"),
    (6.40,  "Months of research. Five chapters."),
    (8.85,  "Scattered everywhere."),
    (12.20, "Academia Scribes brings it all together."),
    (14.90, "Upload your chapters,"),
    (16.38, "and they become your private knowledge base."),
    (19.05, "Ask anything about your project,"),
    (21.25, "and get answers from your own work, with the source."),
    (24.45, "Turn every chapter into flashcards and quizzes."),
    (28.55, "Face the questions your panel will ask,", 1.05),
    (31.05, "and know how ready you are."),
    (beat(40), "Understand it.", 1.05),
    (beat(42), "Remember it."),
    (beat(44), "Practice it."),
    (beat(46), "Defend it."),
    (37.60, "Academia Scribes."),
    (39.30, "Walk into your defense with clarity."),
]
