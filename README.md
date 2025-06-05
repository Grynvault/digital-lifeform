# digital-lifeform

This project implements a simple evolutionary lifeform simulation in the
browser using **p5.js** and **TensorFlow.js**. Each lifeform is driven by a small
neural network. Lifeforms search for food, reproduce when fed, and evolve across
generations through random mutations of their brains.

Features:

- Energy increases slightly with each generation making offspring stronger.
- Starting from generation 3, lifeforms can consume weaker lifeforms for a
  larger energy boost and an additional offspring.
- A lineage tracker displays the population count and highest generation for
  each ancestor so it's easy to see which ancestral line survives the longest.
- Adjust the simulation speed with a slider below the canvas.

Open `index.html` in a browser to run the simulation.
