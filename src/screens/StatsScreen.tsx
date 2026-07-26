import { dayKeyOffset, todayKey, useAppState } from '../lib/store';
import { wordsLearnedCount } from '../lib/srs';
import { ACHIEVEMENTS } from '../lib/achievements';

export function StatsScreen() {
  const app = useAppState();

  // Last 7 days XP (chart)
  const days = Array.from({ length: 7 }, (_, i) => {
    const key = dayKeyOffset(i - 6);
    return { key, label: new Date(key + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' }), xp: app.xpByDay[key] ?? 0 };
  });
  const maxXp = Math.max(app.settings.dailyGoal, ...days.map((d) => d.xp));

  // 12-week calendar heatmap (sequential green ramp)
  const today = new Date();
  const weeks: { key: string; xp: number; inFuture: boolean }[][] = [];
  const startOffset = -(7 * 11 + today.getDay()); // start of week, 12 weeks back
  for (let w = 0; w < 12; w++) {
    const col: { key: string; xp: number; inFuture: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const off = startOffset + w * 7 + d;
      const key = dayKeyOffset(off);
      col.push({ key, xp: app.xpByDay[key] ?? 0, inFuture: off > 0 });
    }
    weeks.push(col);
  }
  const heatColor = (xp: number) => {
    if (xp === 0) return 'var(--heat-0)';
    if (xp < 20) return 'var(--heat-1)';
    if (xp < 40) return 'var(--heat-2)';
    return 'var(--heat-3)';
  };

  const accuracy = app.totalAnswers > 0 ? Math.round((100 * app.correctAnswers) / app.totalAnswers) : 0;
  const minutes = Math.round(app.timeSpentMs / 60000);
  const todayXp = app.xpByDay[todayKey()] ?? 0;
  const goalPct = Math.min(100, Math.round((100 * todayXp) / app.settings.dailyGoal));

  return (
    <div className="stats-screen">
      <div className="daily-goal-card">
        <div className="dg-text">
          <b>Daily goal</b>
          <span>
            {todayXp} / {app.settings.dailyGoal} XP {goalPct >= 100 ? '· done! 🎉' : ''}
          </span>
        </div>
        <div className="dg-bar">
          <div className="dg-fill" style={{ width: `${goalPct}%` }} />
        </div>
      </div>

      <div className="stat-tiles">
        <div className="stat-tile">
          <span className="stat-icon">🔥</span>
          <b>{app.streak}</b>
          <span>day streak</span>
        </div>
        <div className="stat-tile">
          <span className="stat-icon">⚡</span>
          <b>{app.xp}</b>
          <span>total XP</span>
        </div>
        <div className="stat-tile">
          <span className="stat-icon">📖</span>
          <b>{wordsLearnedCount(app)}</b>
          <span>words</span>
        </div>
        <div className="stat-tile">
          <span className="stat-icon">🎯</span>
          <b>{accuracy}%</b>
          <span>accuracy</span>
        </div>
        <div className="stat-tile">
          <span className="stat-icon">🏅</span>
          <b>{app.longestStreak}</b>
          <span>best streak</span>
        </div>
        <div className="stat-tile">
          <span className="stat-icon">⏱️</span>
          <b>{minutes}</b>
          <span>minutes</span>
        </div>
      </div>

      <div className="chart-card">
        <h3>XP this week</h3>
        <div className="week-chart" role="img" aria-label={`XP per day this week: ${days.map((d) => `${d.label} ${d.xp}`).join(', ')}`}>
          {days.map((d) => (
            <div key={d.key} className="wc-col">
              <div className="wc-value">{d.xp > 0 ? d.xp : ''}</div>
              <div className="wc-bar-area">
                <div
                  className={`wc-bar ${d.key === todayKey() ? 'today' : ''}`}
                  style={{ height: `${Math.max(d.xp > 0 ? 6 : 2, (d.xp / maxXp) * 100)}%` }}
                />
              </div>
              <div className="wc-label">{d.label}</div>
            </div>
          ))}
        </div>
        <div className="wc-goal-note">Goal: {app.settings.dailyGoal} XP/day</div>
      </div>

      <div className="chart-card">
        <h3>Activity · last 12 weeks</h3>
        <div className="heatmap">
          {weeks.map((col, w) => (
            <div key={w} className="heat-col">
              {col.map((d) => (
                <div
                  key={d.key}
                  className="heat-cell"
                  title={`${d.key}: ${d.xp} XP`}
                  style={{ background: d.inFuture ? 'transparent' : heatColor(d.xp) }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="heat-legend">
          <span>Less</span>
          <div className="heat-cell" style={{ background: 'var(--heat-0)' }} />
          <div className="heat-cell" style={{ background: 'var(--heat-1)' }} />
          <div className="heat-cell" style={{ background: 'var(--heat-2)' }} />
          <div className="heat-cell" style={{ background: 'var(--heat-3)' }} />
          <span>More</span>
        </div>
      </div>

      <div className="chart-card">
        <h3>Achievements</h3>
        <div className="achievements">
          {ACHIEVEMENTS.map((a) => {
            const earned = !!app.achievements[a.id];
            const p = a.progress(app);
            return (
              <div key={a.id} className={`ach ${earned ? 'earned' : ''}`}>
                <span className="ach-icon">{a.icon}</span>
                <div className="ach-body">
                  <b>{a.title}</b>
                  <span>{a.desc}</span>
                  {!earned && (
                    <div className="ach-bar">
                      <div className="ach-fill" style={{ width: `${(100 * p.cur) / p.max}%` }} />
                    </div>
                  )}
                </div>
                {earned && <span className="ach-check">✓</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
