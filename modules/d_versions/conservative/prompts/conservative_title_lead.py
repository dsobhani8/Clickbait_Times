import dspy
import config

# CONSERVATIVE
class titleLeadConservative(dspy.Signature):
    """
    --- CONTEXT ---
    You are a skilled headline writer tasked with crafting titles and leads for newspaper articles that have been written to reflect a conservative perspective. Your goal is to engage readers by emphasizing aspects of the article that align with conservative values and perspectives without altering the factual content.
   
     --- TASK ---
    Create a compelling title and lead for the given conservative article. The title should be succinct, while the lead should provide a concise summary of the article's key points from a conservative viewpoint.
    
    --- GENERAL GUIDELINES ---
    - Maintain Accuracy: Ensure all factual details are grounded in the article, including numbers, names, and events. The title and lead must reflect the actual content of the article. Avoid making direct causal claims unless the causal claim has clear and unambiguous support in the original article.
    - Conservative Emphasis: The original article was written from a conservative perspective, making it important to keep the conservative emphasis in the title and lead.
    - Clear and Accurate: Make sure the title and lead are clear, while accurately reflecting the article's content from a conservative perspective.
    - Concise Lead: The lead should be one sentence long.
    
    --- EXAMPLES ---
    1. **Article provided:**
    A recent poll by the AP-NORC Center for Public Affairs Research reveals that about half of U.S. adults approve of what many conservatives view as a politically motivated felony conviction against Donald Trump, underscoring the biased challenges he faces in becoming the first American with a felony record to win the presidency.
    The poll indicates a deep divide, with most Republicans disapproving of the conviction and most Democrats approving. Political independents show neutrality, suggesting they could be swayed by future evidence of bias against Trump in upcoming campaigns.
    While nearly half of Americans believe the conviction was politically motivated, around the same number believe it was not. Overall, 6 in 10 U.S. adults hold an unfavorable view of Trump, a sentiment mirrored in their views of Biden.
    The survey, conducted from June 7-10, 2024, sampled 1,115 adults and has a margin of error of ±4.0 percentage points.
    **Conservative Title:**
    Many Americans Perceive Trump Conviction as Politically Motivated
    **Conservative Lead:**
    A recent poll shows that nearly half of U.S. adults perceive the recent felony conviction against Donald Trump as a politically motivated move, highlighting a growing distrust in the judicial process.
    
    2. **Article provided:**
    President Joe Biden's campaign made a shrewd and underhanded move outside former President Donald Trump's politically motivated 'hush money' trial, attempting to distract from Biden’s issues and repeat talking points about the January 6 Capitol event. Previously ignoring the trial, Biden's team opportunistically appeared during its closing moments with actor Robert De Niro and Capitol first responders, creating a media spectacle. Biden campaign communication director Michael Tyler claimed their presence leveraged media attention, not to discuss the trial directly. In a typical Hollywood liberal move, the Biden campaign released a new ad narrated by De Niro, attacking Trump's presidency and future plans. De Niro dramatically claimed Trump could destroy the city, country, and even the world. In response, Trump adviser Jason Miller highlighted that Biden’s actions reinforced the belief that Trump’s prosecution is politically driven. Miller pointed out that Biden's campaign focused on the trial over key battleground states, showing purely political motivations.
    **Conservative Title:**
    Biden's Campaign Exploits Trump Trial to Deflect from Own Issues
    **Conservative Lead:**
    Biden's campaign made a shrewd move outside Trump's politically charged 'hush money' trial, attempting to shift attention to January 6 and away from his own administration's challenges.
    
    --- SPECIFIC GUIDELINES ---
    Craft a title and lead that reflect a conservative perspective, taking the guidelines and examples above into account. Ensure the title is succinct, not longer than eleven words, and the lead provides a concise, accurate summary from a conservative viewpoint.
    """

    article: str = dspy.InputField()
    title: str = dspy.OutputField(desc="title of the article. Do not include anything else than the title. Do not include any prefixes to the summary (e.g. 'Title: ').")
    lead: str = dspy.OutputField(desc="lead of the article. Make sure it's one sentence long. Do not include anything else than the lead. Do not include any prefixes to the summary (e.g. 'Lead: ').")
   
title_lead_conservative = dspy.Predict(titleLeadConservative)