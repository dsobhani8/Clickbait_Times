import dspy
import config

# LIBERAL
class titleLeadLiberal(dspy.Signature):
    """
    --- CONTEXT ---
    You are a skilled headline writer tasked with crafting titles and leads for newspaper articles that have been written to reflect a liberal perspective. Your goal is to engage readers by emphasizing aspects of the article that align with liberal values and perspectives without altering the factual content.
    
    --- TASK ---
    Create a compelling title and lead for the given liberal article. The title should be succinct, while the lead should provide a concise summary of the article's key points from a liberal viewpoint.
    
    --- GENERAL GUIDELINES ---
    - Maintain Accuracy: Ensure all factual details are grounded in the article, including numbers, names, and events. The title and lead must reflect the actual content of the article. Avoid making direct causal claims unless the causal claim has clear and unambiguous support in the original article.
    - Liberal Emphasis: The original article was written from a liberal perspective, making it important to keep the liberal emphasis in the title and lead.
    - Clear and Accurate: Make sure the title and lead are clear, while accurately reflecting the article's content from a liberal perspective.
    - Concise Lead: The lead should be one sentence long.


    --- EXAMPLES ---
    1. **Article provided:**
    Wholesale price increases in the U.S. declined by 0.2% from April to May, signaling potential easing of inflation, as reported by the Labor Department. Year-over-year, wholesale prices rose 2.2% in May. Excluding food and energy, core producer prices were unchanged from April and up 2.3% from the previous year. The producer price index is monitored for insights into consumer inflation trends, as some components contribute to the Federal Reserve's preferred inflation measure, the personal consumption expenditures price index.
    This data followed a report of easing consumer inflation, with core consumer prices rising 0.2% month-over-month, the smallest increase since October, and 3.4% year-over-year, the mildest in three years. Inflation has decreased significantly from its peak of 9.1% two years ago, thanks in part to effective public investments and fiscal policies by the Biden administration, alongside the Fed's interest rate hikes. However, it still remains slightly above the Fed's 2% target, highlighting ongoing challenges in economic stabilization. The Fed recently left its benchmark rate unchanged and revised its forecast to only one rate cut this year.
    Despite the significant progress in moderating inflation, essentials like groceries, rent, and healthcare remain high, presenting persistent challenges for the Biden administration to address. Nonetheless, the U.S. economy shows resilience with low unemployment, steady hiring, and an improved growth forecast from the World Bank, up to 2.5% from 1.6%.
    **Liberal Title:**
    Declining Wholesale Prices Point to Progress in Controlling Inflation
    **Liberal Lead:**
    Wholesale prices in the U.S. fell by 0.2% from April to May, signaling progress in controlling inflation.
    
    2. **Article provided:**
    President Joe Biden's campaign made a strategic appearance outside former President Donald Trump's New York City criminal hush money trial, aiming to shift the race's focus to the Jan. 6, 2021, Capitol insurrection. Biden's team strategically timed their presence to coincide with the closing moments of the trial, bringing actor Robert De Niro and heroic Capitol first responders to emphasize the stakes closely tied with the January 6th insurrection. Biden campaign communication director Michael Tyler clarified that they intended to leverage the significant media attention around the trial to underscore the profound threats posed to democracy, rather than directly address the trial itself.
    The Biden campaign released a compelling new ad narrated by De Niro, powerfully criticizing Trump's presidency and future plans, urging voters to remember the past administration's failures and potential future dangers. De Niro articulated his grave concerns, stating that Trump poses a significant threat that could potentially wreak havoc on the city, country, and the world.
    In a predictable response, Trump allies, including adviser Jason Miller, planned their own press conference, attempting to claim that Biden’s actions underline the notion of a politically driven prosecution of Trump. Miller argued that Biden's campaign focus on the trial instead of key battleground states was politically motivated, a claim that attempts to divert attention from the serious issues raised by Biden's team.
    **Liberal Title:**
    Biden Turns Trump's Hush Money Trial Into Campaign Opportunity
    **Liberal Lead:**
    Biden's campaign seizes the media spotlight on Trump's hush money trial to remind Americans of the dangers to democracy of a second Trump presidency.
    --- SPECIFIC GUIDELINES ---
    Craft a title and lead that reflect a liberal perspective, taking the guidelines and examples above into account. Ensure the title is succinct, not longer than eleven words, and the lead provides a concise, accurate summary from a liberal viewpoint.
    """
    
    article: str = dspy.InputField()
    title: str = dspy.OutputField(desc="title of the article. Do not include anything else than the title. Do not include any prefixes to the summary (e.g. 'Title: ').")
    lead: str = dspy.OutputField(desc="lead of the article. Make sure it's one sentence long. Do not include anything else than the lead. Do not include any prefixes to the summary (e.g. 'Lead: ').")

title_lead_liberal = dspy.Predict(titleLeadLiberal)