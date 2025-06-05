# digital-lifeform

This project implements a simple evolutionary lifeform simulation in the
browser using **p5.js** and **TensorFlow.js**. Each lifeform is driven by a small
neural network. Lifeforms search for food, reproduce when fed, and evolve across
generations through random mutations of their brains.

Features:

- Energy increases slightly with each generation making offspring stronger.
- Energy drains faster the quicker a lifeform moves and only slowly while it
  sits idle.
- Lifeform size grows and shrinks with the amount of energy it currently has.
- Starting from generation 3, lifeforms can consume weaker lifeforms for a
  larger energy boost and an additional offspring, but prey must be at least 10
  generations behind and the predator must have more than half of the prey's
  energy.
- Lifeforms reproduce only when they have more than half of their birth
  energy.
- A deeper neural network with generation as an extra input guides movement,
  making higher generations a bit smarter.
- Each lifeform displays its current energy level above its body.
- Food spawns in random amounts and intervals to vary resource availability.
- A lineage tracker displays the population count and highest generation for
  each ancestor so it's easy to see which ancestral line survives the longest.
- Adjust the simulation speed with a slider below the canvas.

Open `index.html` in a browser to run the simulation.
