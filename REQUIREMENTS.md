# Recipe app: Saveur

I want to save recipes from the internet, and render them in a mobile friendly format that I can display on a phone or tablet.

## Use cases

### Sources

- **Gousto**: I subscribe to Gousto, the UK food delivery service. Sometimes I like a Gousto recipe and I want to save it.  Gousto recipes are available online. I would provide the URL of the online version. Example: https://www.gousto.co.uk/cookbook/fish-recipes/classic-kedgeree-with-roast-cherry-tomatoes.  
- **BBC Good food**: I often use BBC Good Food website but it has a ton of ads and visual distractions, and I would prefer to consume the recipes in a more accessible form
- **Physical book**: I might sometimes take a photo of a recipe from a physical book and want to add that. (Phase 2)

### Usage

- **Shopping**: I may want to use the recipe to shop for the ingredients, consulting the list and ticking off items as I find them in the shop
- **Prep**: I often want to be able to prep the raw ingredients and combine them as much as possible prior to doing any timed steps.
- **Cooking steps**: When cooking steps require timing the action, I'd like to make sure that I do it for the correct amount of time, while also moving on to the next step if steps can overlap (eg step 2 is put something in the oven for 30 mins, so we start the oven timer, and the next step is to shallow fry something for 6 minutes, so the timers end up running in parallel)

## Specific requirements

### Technology and platform

Prefer: 
  - TypeScript
  - Serverless
  - simple deployment orchestration via an all-in-one cloud provider like Railway, Render or Google App Engine
  - on-demand billing
Avoid:
  - Tailwind CSS

### Features - phase 1

- Recipe data model
  - title, eg Classic Kedgeree With Roasted Tomatoes
  - sourceType, enum URL | SCAN | MANUAL
  - sourceRef, eg a url or bibliographic reference
  - photo (not sure how to store - in db or separate file/blob store?)
  - description
  - tags (array of strings for now)
  - timeRequiredMinutes
  - servingCount
  - ingredients (array of objects)
    - name
    - quantity
    - unit (enum: UNIT | ML | GRAM | TSP | TBSP | PINCH | HANDFUL etc)
  - advancePrepSteps (array of objects)
    - instruction (eg "Prepare spice mix")
    - detail (eg "Combine the 2tbsp curry powder and 1tsp ground turmeric in a small bowl")
  - cookSteps (array of objects)
    - instruction (eg. "Toast spices and rice")
    - detail
    - timerTimeSeconds (null if no timer)
- UI views
  - Home view / recipe list
    - Show photos
    - Search by ingredient or tag
  - Recipe view
    - Allow number of servings to be scaled.  Where an ingredient can't be precisely scaled, round up or down as appropriate (eg a number of eggs)
    - Use Wakelock to prevent screen saver.  Provide visual indication of wake lock enabled
  - Recipe edit
  - New recipe
    - Enter URL (ideally also allow a 'share to Saveur' option that could appear in the share card when in iOS browser and choosing to share a webpage)
    - Enter manually

### Open questions

- How can the data model be improved?
- How to store photos?
- Tagging in future could be separated into taxonomies for cuisine, spice level, main protein, occasion etc.  For now what can we do to try and constrain tags into as clean a set as possible?
- Don't want to do macros now but if I wanted to add in future, anything I should think about now?