/**
 * Knapsack optimization for itinerary selection
 * @param {Array} items - [{ destination, score }]
 * @param {Number} budget
 */
function knapsackOptimize(items, budget) {
  const n = items.length;

  // dp[i][w] = max score using first i items with budget w
  const dp = Array.from({ length: n + 1 }, () =>
    Array(budget + 1).fill(0)
  );

  // Build DP table
  for (let i = 1; i <= n; i++) {
    const cost = items[i - 1].destination.estimatedCost;
    const value = items[i - 1].score;

    for (let w = 0; w <= budget; w++) {
      if (cost <= w) {
        dp[i][w] = Math.max(
          dp[i - 1][w],
          dp[i - 1][w - cost] + value
        );
      } else {
        dp[i][w] = dp[i - 1][w];
      }
    }
  }

  // Backtrack to find selected items
  let w = budget;
  const selected = [];

  for (let i = n; i > 0 && w >= 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      const item = items[i - 1];
      selected.push(item);
      w -= item.destination.estimatedCost;
    }
  }

  return selected.reverse();
}

module.exports = {
  knapsackOptimize
};
