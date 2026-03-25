import dspy
import config

class CustomizationRater(dspy.Signature):
    """
    ---Context---
    You operate a news website in the U.S., customizing news articles to suit reader preferences. Customizations alter the tone without changing factual content or length. Customization options include: Political Leaning, Complexity, Sentiment, Entertainment

    ---Task--
    You will be provided with a news article. For each customization option, evaluate the potential benefits of rewriting the article in different styles. Assess the value these customizations could bring to various segments of our readership.

    ---Evaluation Criteria---
    - Provide an overall score (1 to 10) considering both the upsides (e.g., increased engagement) and potential downsides (e.g., insensitivity or inappropriateness). 
    - Significant potential downsides (e.g. risk of losing credibility by being perceived as trivializing potentially inappropriate or tragic issues) should weigh more heavily than significant potential upsides. Be especially sensitive to stories including death, war, and different types of abuses.
    - Sensitive stories do not include those with polarization potential.

    ---Output Requirements---	
    - Score: Provide a holistic evaluation score, explaining the rationale without solely averaging the dimension scores, remember to weigh potential downsides more heavily than potential upsides.
    - Reasoning: Explain the rationale for the overall score, considering the potential benefits and risks of customization.

    ---Examples--- 
    Review the following two examples to calibrate your judgments.

    -Article 1- 

    Text:
    "Paul Pressler, a significant figure in the Southern Baptist Convention (SBC), died at 94 on June 7, as announced by a Houston funeral home. Pressler was instrumental in the SBC's 'conservative resurgence' of the 1980s, which aligned the denomination with Republican conservatism and aimed to support GOP candidates. The SBC, which has over 47,000 churches and around 13 million members, did not acknowledge his death at their recent annual meeting.

    Pressler's legacy was overshadowed by allegations of sexual abuse, notably from Gareld Duane Rollins, who claimed Pressler raped him at 14 and continued the abuse for 24 years. Although Pressler denied the accusations and was never criminally charged, these allegations spurred a major investigation that exposed a sexual abuse crisis within the denomination, leading to significant reforms. Pressler had served in the Texas House and later as a state judge before retiring in 1993."

    Assessment:

    Political Leaning: Limited opportunity to rewrite this in a way that emphasizes political leanings without appearing insensitive due to the serious nature of the allegations.
    Accessibility: The legal and denominational specifics could be simplified, but care must be taken not to trivialize the serious allegations.
    Sentiment: Modifying the sentiment of such a sensitive topic could be viewed as disrespectful or manipulative.
    Entertainment: Attempting to make an article about allegations of abuse and death more entertaining is highly inappropriate and risks significant backlash.
    
    Score: 1
    
    Rationale: The overall potential for customization is extremely limited due to the serious and sensitive nature of the topics discussed. Any significant alterations in tone or perspective could be seen as distasteful or unethical.

    -Article 2-

    Text:
    "U.S. consumer sentiment declined for the third consecutive month in June, with increasing concerns about personal finances and ongoing inflation. The University of Michigan's consumer sentiment index dropped to 65.6 from May's 69.1, still better than June 2022's low during peak inflation but below healthy economic levels.

    Since the pandemic, consumer outlook has been mostly pessimistic and worsened by rising inflation since 2021. This decline in sentiment poses challenges for President Joe Biden's reelection campaign, as consumer spending is crucial for economic growth."

    Assessment:

    Political Leaning: The article's focus on economic issues provides a strong basis for emphasizing either liberal or conservative economic policies, making it highly adaptable to political customization.
    Accessibility: Economic terms and consumer sentiment indices are complex, offering substantial room for simplification to make the content more accessible.
    Sentiment: Adjusting the sentiment can significantly alter reader perceptions, especially in how they view the economic management of the current administration.
    Entertainment: Economic topics, while typically dry, can be made more engaging by relating the statistics to real-life impacts on readers’ daily lives and personal finance stories.
    
    Score: 9

    Rationale: This article offers high potential for customization across all dimensions. The political implications, combined with the complexity of the economic content, allow for significant added value in making the article more accessible, engaging, and aligned with specific political views. This makes it an excellent candidate for customization that could increase reader engagement and satisfaction.
    """
    article: str = dspy.InputField(desc="News article")
    reasoning: str = dspy.OutputField(desc="Reasoning for the customization score")
    score: int = dspy.OutputField(ge=1, le=10, desc="The customization score")

customization_rater = dspy.Predict(CustomizationRater)