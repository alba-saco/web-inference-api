# Web Inference Proof of Concept

## How to run VGGish inference via API
This is specifically for training purposes to get the output of vggish pre-processing, inference, and post-processing in browser to feed into the voice quality classifier model.

1. U already knooow (clone the repo)
2. cd into dir and run ```npm install``` then ```npm run build```
3. To spin up the web app, run ```http-server```
4. In a separate terminal window, run ```node server.cjs``` to spin up the server. If this gives you a problem, try updating ```node``` and ```npm```.
5. Navigate to the web app, and click the button that says 'Start Audio Context'. This is the only interaction with the web app you will need to do, and it's necessary because browsers don't like when you handle audio without the user interacting with the page first (I don't make the rules)
6. Wait for the model to be loaded before making a request.
7. You can now start using the API! I provided an example script (api_inference_example.py) to see how it works.
