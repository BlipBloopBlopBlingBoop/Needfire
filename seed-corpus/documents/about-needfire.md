---
title: About Needfire
domain: reference
tier: C1
license: CC0-1.0
---

# About Needfire

Needfire is an offline survival knowledge computer. It stores a library of
reference material and lets you search and ask questions about it with no
internet connection, drawing on local AI models when they are installed.

The name comes from old European folk practice: when disaster struck, villages
put out every hearth and kindled one new flame by friction — the **needfire** —
then relit every fire from it. This system is a needfire for knowledge: the
reserve you fall back on to relight everything else. The physical device that
carries it is called the **Bothy**, after the unlocked mountain shelters kept
stocked for whoever needs them.

## How to use it
- **Emergency** opens guided step-by-step protocols for life threats (CPR,
  bleeding, choking, and more), with built-in timers. One tap from any screen.
- **Browse** the category cards or **search** for a keyword to find sources.
- **Ask** a question in plain language. Needfire retrieves the most relevant
  sources and, if a local language model is available, writes a short answer
  that **cites those sources**. Always open and read the cited source for
  anything important.
- **Toolkit** holds offline field tools: water disinfection and rehydration
  calculators, timers, a CPR metronome, and rescue signaling aids.

## How it answers
Needfire uses retrieval-augmented generation (RAG): your question is matched
against the knowledge corpus, and the most relevant passages are used to ground
the answer. The knowledge lives in the documents, not in the model — so every
answer points back to a source you can read and verify yourself.

## Important limits
- The bundled "seed" library is a small **starter set** to demonstrate the
  system. The full corpus (encyclopedias, textbooks, medical and technical
  references) is downloaded separately.
- AI models can be wrong. For anything affecting health, safety, chemistry, or
  electricity, **read the cited primary source** and use your own judgement.
- This system is a reference aid, not a substitute for trained professionals,
  proper equipment, or common sense.

## Degrade-gracefully
Needfire is built to keep working as conditions worsen: large model, then small
model, then plain source search, then keyword search. Even with no AI model at
all, it still finds and shows you the relevant documents.
