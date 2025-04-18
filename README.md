# skytruth


Instructions to run app locally:

- Clone the repository to your machine
- Run `npm install`
- Run `npm run dev` to start the vite dev server
- The app should be running locally on port `5173`: http://localhost:5173/

You'll be able to toggle the Earthquake and Outdoors layers separately or have them display at the same time. Moving the map around will load the earthquake data for the new bounding box, but you will exceed the search limit if the map is at too high of a zoom level on certain areas as the earthquake search limit will exceed `20000`.
