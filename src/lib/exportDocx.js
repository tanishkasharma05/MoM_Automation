import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from 'docx';

const heading = (text) =>
  new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } });

const bullet = (text) =>
  new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 80 } });

const body = (text) => new Paragraph({ children: [new TextRun(text)], spacing: { after: 150 } });

export async function generateMomDocx(meeting, mom) {
  const children = [
    new Paragraph({
      children: [new TextRun({ text: meeting.title || 'Minutes of Meeting', bold: true, size: 40 })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${meeting.department || ''}${meeting.department ? ' • ' : ''}${
            meeting.created_at ? new Date(meeting.created_at).toLocaleDateString() : ''
          }`,
          color: '6B7280',
          size: 20,
        }),
      ],
      spacing: { after: 300 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D1D5DB', space: 8 } },
    }),
  ];

  if (mom.overview) {
    children.push(heading('Meeting Overview'));
    children.push(body(mom.overview));
  }

  if (mom.attendees?.length) {
    children.push(heading('Attendees'));
    mom.attendees.forEach((a) => children.push(bullet(a)));
  }

  if (mom.discussion_points?.length) {
    children.push(heading('Key Discussion Points'));
    mom.discussion_points.forEach((d) => children.push(bullet(d)));
  }

  if (mom.decisions?.length) {
    children.push(heading('Decisions Made'));
    mom.decisions.forEach((d) => children.push(bullet(d)));
  }

  if (mom.action_items?.length) {
    children.push(heading('Action Items'));
    mom.action_items.forEach((item, i) => {
      const isStructured = item && typeof item === 'object';
      const text = isStructured ? item.text : item;
      const meta = isStructured
        ? [item.assignee && `Assignee: ${item.assignee}`, item.due_date && `Due: ${item.due_date}`]
            .filter(Boolean)
            .join('   |   ')
        : '';
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${i + 1}. ${text}`, bold: true })],
          spacing: { after: meta ? 20 : 100 },
        })
      );
      if (meta) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: meta, italics: true, color: '6B7280', size: 20 })],
            spacing: { after: 100 },
          })
        );
      }
    });
  }

  if (mom.next_steps?.length) {
    children.push(heading('Next Steps'));
    mom.next_steps.forEach((s) => children.push(bullet(s)));
  }

  if (mom.risks_concerns?.length) {
    children.push(heading('Risks & Concerns'));
    mom.risks_concerns.forEach((r) => children.push(bullet(r)));
  }

  if (mom.follow_up_items?.length) {
    children.push(heading('Follow-up Items'));
    mom.follow_up_items.forEach((f) => children.push(bullet(f)));
  }

  if (mom.next_meeting) {
    children.push(heading('Next Meeting'));
    children.push(body(mom.next_meeting));
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(meeting.title || 'MoM').replace(/[^a-z0-9]+/gi, '_')}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
