import { useState } from 'react';
import { CROWN_LEVELS, LESSONS_PER_LEVEL, sections, skillOrder } from '../data/course';
import type { Skill } from '../types';
import { getSkillProgress, useAppState } from '../lib/store';

interface Props {
  onStartLesson: (skill: Skill) => void;
}

export function PathScreen({ onStartLesson }: Props) {
  const app = useAppState();
  const [openSkill, setOpenSkill] = useState<Skill | null>(null);
  const [showTips, setShowTips] = useState(false);

  // All skills are open — learn in any order, at your own pace
  const unlocked = new Set<string>(skillOrder);

  return (
    <div className="path">
      {sections.map((sec) => (
        <div key={sec.id} className="section">
          <div className="section-header" style={{ background: sec.color }}>
            <div className="section-title">{sec.title}</div>
            <div className="section-sub">
              {sec.skills.filter((sk) => getSkillProgress(app, sk.id).crowns >= CROWN_LEVELS).length}/{sec.skills.length} skills mastered
            </div>
          </div>
          <div className="skill-nodes">
            {sec.skills.map((sk, i) => {
              const prog = getSkillProgress(app, sk.id);
              const isUnlocked = unlocked.has(sk.id);
              const mastered = prog.crowns >= CROWN_LEVELS;
              const pct = (prog.crowns * LESSONS_PER_LEVEL + prog.lessonsDone) / (CROWN_LEVELS * LESSONS_PER_LEVEL);
              return (
                <div key={sk.id} className={`skill-node offset-${i % 4}`}>
                  <button
                    className={`skill-btn ${!isUnlocked ? 'locked' : ''} ${mastered ? 'mastered' : ''}`}
                    style={isUnlocked && !mastered ? { borderColor: sec.color } : undefined}
                    disabled={!isUnlocked}
                    onClick={() => {
                      setOpenSkill(sk);
                      setShowTips(false);
                    }}
                  >
                    <svg className="skill-ring" viewBox="0 0 100 100" aria-hidden>
                      <circle cx="50" cy="50" r="46" fill="none" stroke="#e5e5e5" strokeWidth="7" />
                      <circle
                        cx="50"
                        cy="50"
                        r="46"
                        fill="none"
                        stroke={mastered ? '#ffc800' : sec.color}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={`${pct * 289} 289`}
                        transform="rotate(-90 50 50)"
                      />
                    </svg>
                    <span className="skill-icon">{isUnlocked ? sk.icon : '🔒'}</span>
                    {prog.crowns > 0 && (
                      <span className="crown-badge">
                        👑{prog.crowns}
                      </span>
                    )}
                  </button>
                  <div className="skill-label">{sk.title}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="path-end">🏁 Сайн байна! You have reached the end of the course.</div>

      {openSkill && (
        <div className="modal-backdrop" onClick={() => setOpenSkill(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const prog = getSkillProgress(app, openSkill.id);
              const mastered = prog.crowns >= CROWN_LEVELS;
              return (
                <>
                  <div className="modal-icon">{openSkill.icon}</div>
                  <h3>{openSkill.title}</h3>
                  <div className="modal-crowns">
                    {Array.from({ length: CROWN_LEVELS }, (_, i) => (
                      <span key={i} className={i < prog.crowns ? 'crown on' : 'crown'}>
                        👑
                      </span>
                    ))}
                  </div>
                  <div className="modal-sub">
                    {mastered
                      ? 'Mastered! Practice to keep it fresh.'
                      : `Level ${prog.crowns + 1} · Lesson ${prog.lessonsDone + 1} of ${LESSONS_PER_LEVEL}`}
                  </div>
                  {showTips && openSkill.tips ? (
                    <div className="tips">
                      {openSkill.tips.split('\n\n').map((p, i) => (
                        <p key={i} dangerouslySetInnerHTML={{ __html: p.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') }} />
                      ))}
                    </div>
                  ) : null}
                  <div className="modal-actions">
                    {openSkill.tips && (
                      <button className="btn-big btn-outline" onClick={() => setShowTips(!showTips)}>
                        {showTips ? 'HIDE TIPS' : '💡 TIPS'}
                      </button>
                    )}
                    <button
                      className="btn-big btn-green"
                      onClick={() => {
                        setOpenSkill(null);
                        onStartLesson(openSkill);
                      }}
                    >
                      {mastered ? 'PRACTICE +10 XP' : `START LESSON +10 XP`}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
