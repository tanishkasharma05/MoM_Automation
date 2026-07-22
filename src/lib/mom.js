// The AI doesn't always follow the requested JSON schema exactly (e.g. it
// might return "decisions" as a single string instead of an array, or wrap
// "overview" in an object). This normalizes whatever comes back into the
// shape the UI expects, so a slightly-off AI response never crashes render.

const toStringArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((v) => (typeof v === 'string' ? v : JSON.stringify(v)));
  if (typeof val === 'string') return [val];
  return [JSON.stringify(val)];
};

const toText = (val) => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.join('\n');
  return JSON.stringify(val);
};

const toActionItems = (val) => {
  if (!val) return [];
  const arr = Array.isArray(val) ? val : [val];
  return arr.map((item) => {
    if (typeof item === 'string') return { text: item, assignee: 'Unassigned', due_date: '' };
    if (item && typeof item === 'object') {
      return {
        text: item.text || item.task || item.description || JSON.stringify(item),
        assignee: item.assignee || item.owner || 'Unassigned',
        due_date: item.due_date || item.deadline || '',
      };
    }
    return { text: String(item), assignee: 'Unassigned', due_date: '' };
  });
};

export function normalizeMoM(mom) {
  if (!mom || typeof mom !== 'object') return null;
  return {
    overview: toText(mom.overview),
    attendees: toStringArray(mom.attendees),
    discussion_points: toStringArray(mom.discussion_points),
    decisions: toStringArray(mom.decisions),
    action_items: toActionItems(mom.action_items),
    next_steps: toStringArray(mom.next_steps),
    risks_concerns: toStringArray(mom.risks_concerns),
    follow_up_items: toStringArray(mom.follow_up_items),
    next_meeting: toText(mom.next_meeting),
  };
}
