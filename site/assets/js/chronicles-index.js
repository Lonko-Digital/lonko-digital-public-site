/* Local editorial filters; no network calls or measurement changes. */
(function () {
  'use strict';
  var root = document.querySelector('.ci-home');
  if (!root) return;
  var cards = Array.from(root.querySelectorAll('[data-index-grid] .ci-card'));
  var featured = Array.from(root.querySelectorAll('.ci-feature .ci-card'));
  var featureRow = root.querySelector('.ci-feature');
  var support = root.querySelector('.ci-support');
  var tabs = Array.from(root.querySelectorAll('[data-index-topic]'));
  var more = root.querySelector('[data-index-more]');
  var status = root.querySelector('.ci-filter-status');
  var topic = 'Latest';
  var limit = 9;
  function matchesTopic(card) {
    return topic === 'Latest' || (card.dataset.indexTopics || '').split('|').includes(topic);
  }
  function render() {
    var matches = cards.filter(matchesTopic);
    var featuredMatches = featured.filter(matchesTopic);
    featured.forEach(function (card) { card.hidden = !featuredMatches.includes(card); });
    if (featureRow) {
      featureRow.hidden = featuredMatches.length === 0;
      featureRow.classList.toggle('ci-feature--filtered', topic !== 'Latest');
    }
    if (support) support.hidden = !featuredMatches.some(function (card) { return support.contains(card); });
    cards.forEach(function (card) { card.hidden = !matches.slice(0, limit).includes(card); });
    more.hidden = matches.length <= limit;
    var total = matches.length + (topic === 'Latest' ? 0 : featuredMatches.length);
    status.textContent = total ? total + (total === 1 ? ' story' : ' stories') : 'No stories in this topic yet. Explore Latest for all stories.';
    /* Repack matching cards around the single mid-page newsletter. */
    var grids = root.querySelectorAll('[data-index-grid]');
    matches.forEach(function (card, index) { grids[index < 3 ? 0 : 1].appendChild(card); });
    cards.filter(function (card) { return !matches.includes(card); }).forEach(function (card) { grids[1].appendChild(card); });
  }
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      topic = tab.dataset.indexTopic;
      limit = 9;
      tabs.forEach(function (item) { item.setAttribute('aria-pressed', String(item === tab)); });
      render();
    });
  });
  more.addEventListener('click', function () {
    var previous = cards.filter(function (card) { return !card.hidden; }).length;
    limit += 9;
    render();
    var visible = cards.filter(function (card) { return !card.hidden; });
    if (visible[previous]) visible[previous].querySelector('a').focus();
  });
  render();
}());
