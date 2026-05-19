const KIND_WIN_LABELS = {
  rock: "ROCKS",
  paper: "PAPERS",
  scissors: "SCISSORS",
};

/** @returns {Promise<"rock"|"paper"|"scissors">} */
export function promptBet() {
  return new Promise((resolve) => {
    const overlay = document.getElementById("bet-overlay");
    const buttons = overlay.querySelectorAll("[data-bet]");

    overlay.classList.remove("hidden");

    const onPick = (e) => {
      const kind = e.currentTarget.dataset.bet;
      if (!kind) return;
      buttons.forEach((btn) => btn.removeEventListener("click", onPick));
      overlay.classList.add("hidden");
      resolve(kind);
    };

    buttons.forEach((btn) => btn.addEventListener("click", onPick));
  });
}

/** @returns {Promise<void>} */
export function showBetResult(won, winnerKind) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("result-overlay");
    const msg = document.getElementById("result-message");
    const label = KIND_WIN_LABELS[winnerKind] ?? String(winnerKind).toUpperCase();

    msg.className = won ? "result-win" : "result-lose";
    msg.textContent = won
      ? `HURRRAYYYY! YOU WON THE BET ${label} WON!!!!`
      : "Bet Lost!!! Better luck next time!!!";

    overlay.classList.remove("hidden");

    const btn = document.getElementById("result-continue");
    const onContinue = () => {
      btn.removeEventListener("click", onContinue);
      overlay.classList.add("hidden");
      resolve();
    };
    btn.addEventListener("click", onContinue);
  });
}
