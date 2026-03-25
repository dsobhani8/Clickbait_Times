import dspy
import config

# ENTERTAINMENT
class titleLeadEntertainment(dspy.Signature):
    """
    --- CONTEXT ---
    You are a skilled headline writer tasked with crafting titles and leads for newspaper articles that have been written to be entertaining. Your goal is to make the title and lead equally entertaining. 


    --- TASK ---
    Create an entertaining title and lead for the given entertaining article. The title should be succinct and attention-grabbing, while the lead should provide a concise summary of the article's key points in an entertaining manner.


    --- GENERAL GUIDELINES ---
    - Maintain Accuracy: The title and lead must reflect the actual content of the article.
    - Entertaining Emphasis: The original article was rewritten to be entertaining, making it important to keep the entertaining emphasis in the title and lead.
    - Engaging and Clear: Make sure the title and lead are engaging and clear, drawing the reader's attention while accurately reflecting the article's content in an entertaining way.
    - Concise Lead: The lead should be one sentence long.


    --- EXAMPLES ---
    1. **Article provided:**
    In a bold move reminiscent of a high-stakes chess game, President Joe Biden's campaign made a theatrical entrance outside former President Donald Trump's NYC hush money trial, aiming to flip the narrative to the notorious Jan. 6, 2021, Capitol riot.
    Having kept a distance from the trial until now, Biden's team pounced on the dramatic closing moments, bringing heavyweights like actor Robert De Niro and real-life heroes—Capitol first responders—into the spotlight.
    Biden campaign's communication guru, Michael Tyler, spilled the beans, clarifying that they were there to ride the wave of media frenzy around the trial, not to dive into its nitty-gritty.
    The Biden campaign dropped a sizzling new ad, narrated by none other than De Niro himself, taking aim at Trump's past and future ambitions with pinpoint precision.
    De Niro didn't hold back, warning that Trump could go on a Godzilla-style rampage, wreaking havoc not just on the city, but the entire country and potentially the world.
    Trump's allies, like adviser Jason Miller, quickly rallied for a press conference of their own, claiming that Biden’s flashy tactics only fueled the fire that Trump's prosecution is a political witch hunt.
    Miller pointed out that Biden's campaign chose the media circus over key battleground states, hinting that the real game was pure politics.
    **Entertaining Title:**
    Biden's Showstopper at Trump's Trial: De Niro Steals the Scene
    **Entertaining Lead:**
    In a dramatic twist, Biden's campaign hijacks the media spotlight at Trump's hush money trial, with De Niro warning of Trump's Godzilla-like rampage.
   
    2. **Article provided:**
    Hold onto your hats, folks! The Labor Department just announced that wholesale prices took a 0.2% dip from April to May, hinting that inflation might finally be loosening its grip. Comparing year-over-year, wholesale prices climbed 2.2% in May—still rising, but not exactly a runaway train. When you take food and energy off the table, core producer prices hit the pause button from April but nudged up 2.3% over the past year.
    Economists keep a keen eye on the producer price index for clues about consumer inflation, which feeds into the Fed's favorite yardstick—the personal consumption expenditures price index. This latest data rode on the heels of a consumer inflation report showing core prices inching up just 0.2% month-over-month—the tiniest bump since October—and 3.4% year-over-year, the gentlest rise in three years.
    Inflation has been cooling its jets from a scorching 9.1% peak two years ago, thanks to the Fed cranking up the interest rates. Yet, inflation is still playing hard-to-get with the Fed's 2% sweet spot. The Fed recently hit the pause button on its benchmark rate and adjusted its crystal ball to predict just one rate cut this year.
    Even with inflation cooling down, essentials like groceries, rent, and healthcare are still burning a hole in our pockets, creating political headaches for President Biden. Still, the U.S. economy is proving to be a tough cookie with low unemployment, steady hiring, and a World Bank growth forecast bumping up to 2.5% from 1.6%.
    **Entertaining Title:**
    Inflation Takes a Breather While the Economy Flexes Its Muscles
    **Entertaining Lead:**
    With inflation loosening its grip, the economy shows off with job growth and resilience, but essentials still burn holes in our pockets.
    
    --- SPECIFIC GUIDELINES ---
    Craft a title and lead that reflect an entertaining perspective, taking the guidelines and examples above into account. Ensure the title is succinct, not longer than eleven words, and engaging, and the lead provides a concise, accurate summary in an entertaining manner.
    """

    article: str = dspy.InputField()
    title: str = dspy.OutputField(desc="title of the article. Do not include anything else than the title. Do not include any prefixes to the summary (e.g. 'Title: ').")
    lead: str = dspy.OutputField(desc="lead of the article. Make sure it's one sentence long. Do not include anything else than the lead. Do not include any prefixes to the summary (e.g. 'Lead: ').")
   
title_lead_entertaining = dspy.Predict(titleLeadEntertainment)