DESCRIPTION OF DATA TABLES

- All data tables can be matched based on the common column "user_id."
- Most data tables contain a "created_at" column that shows the exact time of the respective action.
- Each row in each table corresponds to a tracked action of the user (e.g. slider settings update, click on article, etc.).

FILES

- scroll_depth_rows: tracks for each page if user scrolled past 80% of the page; path indicates the page this ocurred on
- slider_tracker_rows: tracks updates of slider settings; that is, it shows the new slider settings, not the change; 
	- Leaning (slant): 0 = liberal, 50 = regular, 100 = conservative
	- Complexity: 0 = regular, 100 = accessible
	- Entertainment: 0 = regular, 100 = accessible
	- Sentiment: 0 = regular, 100 = less negative (THIS WILL CHANGE TO: 0 = less negative, 50 = regular, 100 = more negative)
- track_user_rows: tracks what user clicked on (article, section, settings, etc.)
- user_logs_rows: tracks when users log in and log out
- user_config_rows: shows individual users per row; this is where we assign treatments (what sliders users see wihtin slider box) and specify the slider ordering
- user_rows: shows shows individual users per row; this is where user information are stored; this is where we assign treatments (if users see slider box at all)
- bookmarks_rows: specifies when a user has saved article to read later