import { escapeHtml, renderSignatoryBlock, SIGNATURE_IMAGE_STYLES, type TemplateRenderer } from './shared';

/**
 * SIGO / IEFP-compatible certificate (Portugal). Renders the legal fields a
 * DGERT-certified entity needs for SIGO submission: recipient name + NIF,
 * training entity, training action, UFCD code, total hours, and the training
 * period. Labels are in Portuguese because this is a Portuguese legal document.
 */
export const renderSigo: TemplateRenderer = ({ design, data }) => {
  const accent = design.accentColor;
  const description = design.descriptionOverride || data.courseDescription;
  const [signatoryOne, signatoryTwo] = design.signatories;

  const entity = data.trainingEntity || data.orgName;
  const period =
    data.startDate && data.endDate
      ? `${escapeHtml(data.startDate)} — ${escapeHtml(data.endDate)}`
      : escapeHtml(data.startDate || data.endDate || data.date);

  const detailRow = (label: string, value: string | number | undefined | null): string => {
    if (value === undefined || value === null || value === '') return '';

    return `
      <div class="row">
        <div class="k">${escapeHtml(label)}</div>
        <div class="v">${escapeHtml(value)}</div>
      </div>`;
  };

  const body = `
    <div class="cert t-sigo">
      <div class="frame">
        <header class="head">
          <div class="entity">
            ${data.orgLogoUrl ? `<img class="logo" src="${escapeHtml(data.orgLogoUrl)}" alt="" />` : ''}
            <div class="entity-name">${escapeHtml(entity)}</div>
          </div>
          <div class="ref">${escapeHtml(data.certificateId)}</div>
        </header>

        <div class="lead">Certificado de Formação Profissional</div>

        <div class="declare">Certifica-se que</div>
        <div class="recipient">${escapeHtml(data.recipientName)}</div>
        ${data.nif ? `<div class="nif">NIF ${escapeHtml(data.nif)}</div>` : ''}
        <div class="declare">concluiu com aproveitamento a ação de formação</div>
        <div class="action">${escapeHtml(data.trainingAction || data.courseName)}</div>
        ${description ? `<div class="description">${escapeHtml(description)}</div>` : ''}

        <div class="details">
          ${detailRow('Entidade formadora', entity)}
          ${detailRow('Código UFCD', data.ufcdCode)}
          ${detailRow('Carga horária', data.totalHours ? `${data.totalHours} horas` : undefined)}
          ${detailRow('Período', period)}
          ${detailRow('Data de emissão', data.date)}
        </div>

        <div class="signatures">
          ${renderSignatoryBlock(signatoryOne, { nameClass: 'v', roleClass: 'k', roleFirst: false })}
          ${renderSignatoryBlock(signatoryTwo, { nameClass: 'v', roleClass: 'k', roleFirst: false })}
        </div>
      </div>
    </div>
  `;

  const styles = `
    .t-sigo {
      background: #fff;
      color: #14213d;
      font-family: 'Cormorant Garamond', serif;
      padding: 26px;
    }
    .t-sigo .frame {
      height: 100%;
      border: 2px solid ${accent};
      outline: 1px solid ${accent};
      outline-offset: 4px;
      padding: 44px 70px;
      display: flex;
      flex-direction: column;
      text-align: center;
    }
    .t-sigo .head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #d9d9d9;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .t-sigo .entity { display: flex; align-items: center; gap: 12px; }
    .t-sigo .logo { max-height: 42px; width: auto; }
    .t-sigo .entity-name {
      font-family: 'Cinzel', serif;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: ${accent};
    }
    .t-sigo .ref {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      letter-spacing: 0.15em;
      color: #8a8a8a;
    }
    .t-sigo .lead {
      font-family: 'Cinzel', serif;
      font-size: 26px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: ${accent};
      margin-bottom: 26px;
    }
    .t-sigo .declare { font-size: 19px; color: #4a4a4a; margin: 6px 0; }
    .t-sigo .recipient {
      font-size: 52px;
      font-weight: 600;
      line-height: 1.05;
      margin-top: 4px;
    }
    .t-sigo .nif {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      letter-spacing: 0.1em;
      color: #8a8a8a;
      margin-top: 4px;
    }
    .t-sigo .action {
      font-size: 30px;
      font-weight: 600;
      font-style: italic;
      color: ${accent};
      margin-top: 4px;
    }
    .t-sigo .description {
      font-size: 15px;
      color: #555;
      max-width: 760px;
      margin: 12px auto 0;
      line-height: 1.5;
    }
    .t-sigo .details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 40px;
      margin: 26px auto 0;
      max-width: 780px;
      text-align: left;
    }
    .t-sigo .details .row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px dotted #cfcfcf;
      padding: 6px 0;
    }
    .t-sigo .details .k {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #9a9a9a;
      align-self: center;
    }
    .t-sigo .details .v { font-size: 17px; font-weight: 600; }
    .t-sigo .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 60px;
      margin-top: auto;
      padding-top: 30px;
    }
    .t-sigo .signatures .k {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #9a9a9a;
      margin-top: 4px;
      border-top: 1px solid #14213d;
      padding-top: 8px;
    }
    .t-sigo .signatures .v { font-size: 20px; font-weight: 600; }
    ${SIGNATURE_IMAGE_STYLES}
  `;

  return { body, styles };
};
