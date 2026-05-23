
function mountHomeAnimations() {
  const container = document.createElement("div");

  container.innerHTML = `
    <img id="tumbleweed" src="./homepage_gif_assets/littleball.png">

    <div class="reading-gif-container">
      <img src="./homepage_gif_assets/reading1.gif" class="reading1-gif">
      <img src="./homepage_gif_assets/reading2.gif" class="reading2-gif">
    </div>

    <div class="sweep-gif-container">
      <img src="./homepage_gif_assets/sweep1.gif" class="sweep1-gif">
      <img src="./homepage_gif_assets/sweep2.gif" class="sweep2-gif">
    </div>

    <div class="ice-gif-container">
      <img src="./homepage_gif_assets/ice1.gif" class="ice1-gif">
      <img src="./homepage_gif_assets/ice2.gif" class="ice2-gif">
    </div>
  `;

  document.querySelector("#app").appendChild(container);
}

function unmountHomeAnimations() {
  const el = document.querySelector(".homepage-animations-wrapper");
  if (el) el.remove();
}