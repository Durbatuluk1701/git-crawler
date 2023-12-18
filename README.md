Git Crawler

git-crawler
===========

This project was created with the intention of discovering what keys are most common in programming language code files.

At first, it was just the occurences that were tracked, and those database files can be located in the `/archive` folder.

Now, the code has been modified to track the `WINDOW_SIZE` previous characters that occured as well. The current iteration of the database that is tracked utilizes a `WINDOW_SIZE` of 3. Thus it tracks the current character, and the three proceeding characters as well.

Ultimately, the goal of this is to help create an optimized keyboard layout for programming.

Please feel free to utilized the [database](./DB.json) for your own analysis if you so desire.
----------------------------------------------------------------------------------------------
