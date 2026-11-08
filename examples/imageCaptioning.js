CATEGORY = "ML"

script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";

script.onload = run;
document.head.appendChild(script);
eval(script);

const API_url = "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large"
let API_TOKEN = null // asked at run time; never commit a token

async function run() {

  // detect visualization framework
  Boostlet.init();

  const requestData = await request();
  console.log(requestData);

  requestDataText = requestData[0]['generated_text']
  // display the image captioning text
  displayText(requestDataText);

}

async function request() {

  API_TOKEN = API_TOKEN || prompt('Hugging Face access token (huggingface.co/settings/tokens)');

  image = Boostlet.get_image(true); // grab image from canvas
  pixels = image.data;
  width = image.width;
  height = image.height;

  png_image = Boostlet.convert_to_png(pixels, width, height);

  const response = await fetch(API_url, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
    method: "POST",
    body: png_image,
  });

  return await response.json();

}

function displayText(captionText) {

  Boostlet.hint(captionText);

  BoostletHint.onclick = function () {
    // destroy on click
    window.document.body.removeChild(BoostletHint);
  }

}