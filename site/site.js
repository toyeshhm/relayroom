const examples = {
  install: `npm install -g github:toyeshhm/relayroom
relayroom init
relayroom adapters install`,
  capture: `relayroom note "Stripe webhook is server-only."
relayroom capture \\
  --task "Checkout flow" \\
  --note "Cart works; webhook tests remain."`,
  resume: `relayroom resume claude --copy
relayroom resume cursor --print
relayroom pack --agent codex --out handoff.md`
};

const output = document.querySelector("#command-output code");
document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
    output.textContent = examples[button.dataset.panel];
  });
});
