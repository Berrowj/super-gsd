'use strict';

/**
 * @example
 * synthesize([
 *   { role: 'A', position: 'SUPPORT', confidence: 3 },
 *   { role: 'B', position: 'OPPOSE', confidence: 3 },
 * ]);
 * // => { decision: 'TIE', sum: 0, tiebreaker_applied: true, raw_votes: [...] }
 */
function synthesize(members) {
  const raw_votes = members.map((member) => ({
    role: member.role,
    position: member.position,
    confidence: member.confidence,
  }));

  let sum = 0;
  for (const member of members) {
    if (member.position === 'SUPPORT') sum += member.confidence;
    else if (member.position === 'OPPOSE') sum -= member.confidence;
  }

  let decision = 'TIE';
  let tiebreaker_applied = false;
  if (sum > 0) decision = 'SUPPORT';
  else if (sum < 0) decision = 'OPPOSE';
  else tiebreaker_applied = true;

  return { decision, sum, tiebreaker_applied, raw_votes };
}

module.exports = { synthesize };
