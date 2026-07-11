Ok now my requirement is that it is now an android app, with really less authorization.

I want to modify this completely such that :
1. It is actually a website and can be downloaded as an app using WebApp.
2. The database should be centralized hosted on Neon.
3. It should be hosted on vercel and tech stack would preferably by next.js for compatibility
4. It should have a user profile with the email and a 4 digit pin as login such that when a user logs in, the diet information is specific to that particular user.
5. There should be a role of "Admin" who can view all users data. So basically there has to be 2 roles, patient and admin. If it is an admin, they can view all the users data and compare and view analytics across all patients for their purpose.
6. The DB has to be such that :
     a. There is one master table which consists of all the food items along with the nutrition details.
     b. There should be a users tables consisting of all the details of the users. Have a seperate medical data table which is mapped to the user by the user_id. So if and when users update their medical data, a new record should be created for the same user differentiated by the date. 
    c. The admin should be able to view all the users data such that admin should have a dashboard of all metrics possible and also view each individual user data wrt the same metrics.
    d. There should be a log table where, when a user inputs their daily food/nutrient intake data, it should be mapped to the user with the user_id. 
These are the attributes for the medical data
Weight
Height
BMI
BP - Low 
BP - High

And these are the attributes for the master table
itemName	Carbohydrates	Protiens	Fats	Calories
All of this is per 100 grams of the items.
 

7. Keeping the entire features of the app intact and the UI/UX of it, give me all the required steps and codes for each file needed telling what to do clearly. Make sure the website/application is compatible and responsive to all screen sizes