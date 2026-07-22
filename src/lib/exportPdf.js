import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MARGIN = 40;
const PAGE_WIDTH = 595.28; // A4 pt
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function addFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `SGEW Group — Confidential | Page ${i} of ${pageCount}`,
      PAGE_WIDTH / 2,
      820,
      { align: 'center' }
    );
  }
}

function ensureSpace(doc, y, needed) {
  if (y + needed > 780) {
    doc.addPage();
    return 60;
  }
  return y;
}

function sectionHeading(doc, text, y) {
  y = ensureSpace(doc, y, 40);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text(text, MARGIN, y);
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y + 6, PAGE_WIDTH - MARGIN, y + 6);
  return y + 26;
}

function bulletList(doc, items, y, emptyText = 'Not specified in the meeting.') {
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);

  const lines = items?.length ? items : [emptyText];
  lines.forEach((item) => {
    const wrapped = doc.splitTextToSize(`•  ${item}`, CONTENT_WIDTH - 10);
    y = ensureSpace(doc, y, wrapped.length * 14 + 4);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 14 + 4;
  });
  return y + 8;
}

function paragraph(doc, text, y, emptyText = 'Not specified in the meeting.') {
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  const wrapped = doc.splitTextToSize(text || emptyText, CONTENT_WIDTH);
  y = ensureSpace(doc, y, wrapped.length * 14 + 4);
  doc.text(wrapped, MARGIN, y);
  return y + wrapped.length * 14 + 12;
}

export function exportMomPdf(meeting, mom) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  // --- Header ---
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text('SGEW Group', MARGIN, 50);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(140, 140, 140);
  doc.text('Meeting Minutes — AI Generated', MARGIN, 64);
  doc.text(new Date().toLocaleDateString('en-GB'), PAGE_WIDTH - MARGIN, 50, { align: 'right' });

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(1.2);
  doc.line(MARGIN, 74, PAGE_WIDTH - MARGIN, 74);

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text(meeting.title || 'Untitled Meeting', MARGIN, 104);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  const dateStr = meeting.meeting_date
    ? new Date(meeting.meeting_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date(meeting.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.text(`Date: ${dateStr}    |    Language: ${meeting.language || 'English'}`, MARGIN, 122);

  let y = 150;

  // --- Concise Summary ---
  y = sectionHeading(doc, 'Concise Summary', y);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text('Meeting Info', MARGIN, y);
  y += 18;
  y = bulletList(doc, [
    `Date: ${dateStr}`,
    `Attendees: ${mom.attendees?.length ? mom.attendees.join(', ') : 'Not specified in the meeting.'}`,
  ], y);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  y = ensureSpace(doc, y, 20);
  doc.text('Key Decisions', MARGIN, y);
  y += 18;
  y = bulletList(doc, mom.decisions, y);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  y = ensureSpace(doc, y, 20);
  doc.text('Action Items', MARGIN, y);
  y += 18;
  const conciseActionLines = mom.action_items?.length
    ? mom.action_items.map((a) => `${a.text}: ${a.assignee || 'Not specified'}, Deadline: ${a.due_date || 'Not specified'}`)
    : [];
  y = bulletList(doc, conciseActionLines, y);

  // --- Detailed Report ---
  doc.addPage();
  y = 60;
  y = sectionHeading(doc, 'Detailed Report', y);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text('Meeting Information', MARGIN, y);
  y += 18;
  y = bulletList(doc, [`Title: ${meeting.title}`, `Date: ${dateStr}`], y);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  y = ensureSpace(doc, y, 20);
  doc.text('Attendees', MARGIN, y);
  y += 18;
  y = bulletList(doc, mom.attendees, y);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  y = ensureSpace(doc, y, 20);
  doc.text('Agenda-wise Discussion', MARGIN, y);
  y += 18;
  y = mom.discussion_points?.length
    ? bulletList(doc, mom.discussion_points, y)
    : paragraph(doc, mom.overview, y);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  y = ensureSpace(doc, y, 20);
  doc.text('Key Decisions', MARGIN, y);
  y += 18;
  y = bulletList(doc, mom.decisions, y);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  y = ensureSpace(doc, y, 20);
  doc.text('Action Items', MARGIN, y);
  y += 10;

  if (mom.action_items?.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Task', 'Owner', 'Deadline', 'Status']],
      body: mom.action_items.map((a) => [
        a.text,
        a.assignee || 'Not specified',
        a.due_date || 'Not specified',
        'Pending',
      ]),
      styles: { fontSize: 9.5, cellPadding: 6, textColor: [55, 65, 81] },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = doc.lastAutoTable.finalY + 20;
  } else {
    y = bulletList(doc, [], y);
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  y = ensureSpace(doc, y, 20);
  doc.text('Risks & Concerns', MARGIN, y);
  y += 18;
  y = bulletList(doc, mom.risks_concerns, y);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  y = ensureSpace(doc, y, 20);
  doc.text('Follow-up Items', MARGIN, y);
  y += 18;
  y = bulletList(doc, mom.follow_up_items, y);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  y = ensureSpace(doc, y, 20);
  doc.text('Next Meeting', MARGIN, y);
  y += 18;
  y = paragraph(doc, mom.next_meeting, y);

  addFooter(doc);

  const filename = `SGEW_MoM_${(meeting.title || 'meeting').replace(/[^a-z0-9]+/gi, '_')}_${dateStr.replace(/\s+/g, '-')}.pdf`;
  doc.save(filename);
}
