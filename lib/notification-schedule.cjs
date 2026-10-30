function localDay(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

async function wallTime(day, time, timeZone) {
  const { localToUtcDetailed } = await import('../geocode.js');
  const input = { date: day, time, timezone: timeZone };
  const first = localToUtcDetailed(input, { resolve: 'earlier' });
  return first.date || localToUtcDetailed(input, { resolve: 'later' }).date;
}

async function nextDue(preference, after, lastDay = null) {
  let day = localDay(after, preference.timeZone);
  for (let i = 0; i < 3; i++) {
    const due = await wallTime(day, preference.time, preference.timeZone);
    if (due > after && day !== lastDay) return due;
    day = new Date(new Date(`${day}T12:00:00Z`).getTime() + 864e5).toISOString().slice(0, 10);
  }
  throw new Error('invalid_schedule');
}

async function endOfDay(date, timeZone) {
  const next = new Date(new Date(`${localDay(date, timeZone)}T12:00:00Z`).getTime() + 864e5).toISOString().slice(0, 10);
  return wallTime(next, '00:00', timeZone);
}

module.exports = { localDay, nextDue, endOfDay };
