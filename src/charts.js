const COLORS = ["#2f80ed", "#27ae60", "#f2994a", "#9b51e0", "#eb5757", "#00a6a6", "#6f5bdf"];

export function drawPieChart(canvas, shares) {
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const radius = Math.min(width, height) * 0.42;
  const centerX = width / 2;
  const centerY = height / 2;
  const total = shares.reduce((sum, share) => sum + share.seconds, 0);

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#f3f5f7";
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();

  if (total <= 0) {
    context.fillStyle = "#67717d";
    context.font = "14px system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText("Noch keine Sprache", centerX, centerY);
    return;
  }

  let startAngle = -Math.PI / 2;

  shares.forEach((share, index) => {
    const angle = (share.seconds / total) * Math.PI * 2;
    context.fillStyle = share.color ?? COLORS[index % COLORS.length];
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.arc(centerX, centerY, radius, startAngle, startAngle + angle);
    context.closePath();
    context.fill();
    startAngle += angle;
  });

  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(centerX, centerY, radius * 0.52, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#17202a";
  context.font = "700 18px system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText(formatDuration(total), centerX, centerY + 6);
}

export function colorForIndex(index) {
  return COLORS[index % COLORS.length];
}

export function formatDuration(seconds) {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60).toString().padStart(2, "0");
  const remainingSeconds = (rounded % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}
