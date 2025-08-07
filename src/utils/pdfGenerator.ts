import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Facture, Devis, BonLivraison, CommandeFournisseur } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatCurrency } from './currency';
import { getCompanyInfo } from './numberGenerator';
import { numberToWords } from './numberToWords';
import { getCurrencySymbol, getCurrencyDecimals } from './currency';
import { calculateTaxesByGroup, loadTaxGroups } from './productTaxCalculator';

const formatDate = (date: Date) => format(date, 'dd/MM/yyyy', { locale: fr });

// Load template settings with enhanced configuration
const getTemplateSettings = async (isElectron: boolean, query?: any) => {
  const defaultSettings = {
    margins: { top: 10, bottom: 10, left: 10, right: 10 },
    logo: { enabled: false, position: 'right', size: 15, width: 22, url: '' },
    title: { fontSize: 18, color: '#2563eb', fontWeight: 'bold', position: 'center', marginBottom: 8 },
    table: { fontSize: 8, headerFontSize: 9, cellPadding: 2, borderWidth: 0.3, model: 'simple' },
    footer: { enabled: true, text: 'Merci pour votre confiance', fontSize: 8, color: '#6b7280', fontWeight: 'normal', position: 'left', showDate: true, customText: '' },
    amountInWords: { enabled: false, position: 'left', fontSize: 8, color: '#000000' },
    titlePosition: 'body',
    colors: { primary: '#2563eb', text: '#000000', light: '#f8fafc', border: '#e2e8f0' },
    fonts: { 
      title: { size: 18, weight: 'bold', color: '#2563eb' },
      heading: { size: 11, weight: 'bold', color: '#000000' },
      body: { size: 9, weight: 'normal', color: '#000000' },
      small: { size: 7, weight: 'normal', color: '#6b7280' },
      footer: { size: 8, weight: 'normal', color: '#6b7280' }
    },
    spacing: { section: 8, line: 4, element: 6 }
  };

  try {
    if (isElectron && query) {
      const result = await query('SELECT value FROM settings WHERE key = ?', ['templateSettings']);
      if (result.length > 0) {
        const savedSettings = JSON.parse(result[0].value);
        return { ...defaultSettings, ...savedSettings };
      }
    }
  } catch (error) {
    console.error('Error loading template settings:', error);
  }

  return defaultSettings;
};

// Load logo
const getTemplateLogo = async (isElectron: boolean, query?: any) => {
  try {
    if (isElectron && query) {
      const result = await query('SELECT value FROM settings WHERE key = ?', ['templateLogo']);
      if (result.length > 0) {
        return result[0].value;
      }
    }
  } catch (error) {
    console.error('Error loading template logo:', error);
  }
  return null;
};

// Convert hex to RGB
const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
};

// Enhanced header with customizable logo positioning and sizing
const renderEnhancedHeader = (doc: jsPDF, settings: any, companyInfo: any, logoUrl?: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = settings.margins.top;
  
  // Company information positioning
  const companyX = settings.logo.enabled && settings.logo.position === 'left' ? 
    settings.margins.left + (settings.logo.width || 22) + 10 : settings.margins.left;
  
  // Company information
  doc.setFontSize(settings.fonts.heading.size);
  doc.setTextColor(...hexToRgb(settings.fonts.heading.color));
  doc.setFont('helvetica', settings.fonts.heading.weight);
  
  doc.text(companyInfo.nom, companyX, currentY);
  currentY += settings.spacing.line;
  
  // Company details
  doc.setFont('helvetica', settings.fonts.body.weight);
  doc.setFontSize(settings.fonts.body.size);
  doc.setTextColor(...hexToRgb(settings.fonts.body.color));
  
  const companyLines = [
    companyInfo.adresse,
    `${companyInfo.codePostal} ${companyInfo.ville}`,
    `Tél: ${companyInfo.telephone} | Email: ${companyInfo.email}`,
    companyInfo.matriculeFiscal ? `Matricule Fiscal: ${companyInfo.matriculeFiscal}` : '',
    companyInfo.tva ? `TVA: ${companyInfo.tva}` : ''
  ].filter(line => line.trim());
  
  companyLines.forEach(line => {
    doc.text(line, companyX, currentY);
    currentY += settings.spacing.line;
  });
  
  // Logo with customizable size and position
  if (settings.logo.enabled && logoUrl) {
    const logoHeight = settings.logo.size;
    const logoWidth = settings.logo.width || (logoHeight * 1.5);
    
    let logoX: number;
    switch (settings.logo.position) {
      case 'left':
        logoX = settings.margins.left;
        break;
      case 'center':
        logoX = (pageWidth - logoWidth) / 2;
        break;
      case 'right':
      default:
        logoX = pageWidth - settings.margins.right - logoWidth;
        break;
    }
    
    const logoY = settings.margins.top;
    
    try {
      doc.addImage(logoUrl, 'JPEG', logoX, logoY, logoWidth, logoHeight);
    } catch (error) {
      console.error('Error adding logo to PDF:', error);
    }
  }
  
  return Math.max(currentY, settings.margins.top + (settings.logo.enabled ? settings.logo.size : 0)) + settings.spacing.section;
};

// Enhanced title with customizable styling
const renderEnhancedTitle = (doc: jsPDF, settings: any, documentTitle: string, documentData: any, startY: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = startY;
  
  // Document title with custom styling
  doc.setFontSize(settings.title.fontSize);
  doc.setTextColor(...hexToRgb(settings.title.color));
  doc.setFont('helvetica', settings.title.fontWeight);
  
  const titleWidth = doc.getTextWidth(documentTitle);
  let titleX: number;
  
  switch (settings.title.position) {
    case 'left':
      titleX = settings.margins.left;
      break;
    case 'right':
      titleX = pageWidth - settings.margins.right - titleWidth;
      break;
    case 'center':
    default:
      titleX = (pageWidth - titleWidth) / 2;
      break;
  }
  
  doc.text(documentTitle, titleX, currentY);
  currentY += settings.title.marginBottom;
  
  // Horizontal line under title
  doc.setDrawColor(...hexToRgb(settings.colors.border));
  doc.setLineWidth(0.5);
  doc.line(settings.margins.left, currentY, pageWidth - settings.margins.right, currentY);
  
  currentY += settings.spacing.section;
  
  // Document details - right aligned
  const rightX = pageWidth - settings.margins.right;
  
  doc.setFontSize(settings.fonts.body.size);
  doc.setTextColor(...hexToRgb(settings.fonts.body.color));
  doc.setFont('helvetica', 'bold');
  
  doc.text(`N° ${documentData.numero}`, rightX, currentY, { align: 'right' });
  currentY += settings.spacing.line;
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${formatDate(documentData.date)}`, rightX, currentY, { align: 'right' });
  currentY += settings.spacing.line;
  
  // Additional date based on document type
  if (documentData.type === 'facture') {
    doc.text(`Échéance: ${formatDate(documentData.dateEcheance)}`, rightX, currentY, { align: 'right' });
  } else if (documentData.type === 'devis') {
    doc.text(`Validité: ${formatDate(documentData.dateValidite)}`, rightX, currentY, { align: 'right' });
  } else if (documentData.type === 'commande') {
    doc.text(`Réception: ${formatDate(documentData.dateReception)}`, rightX, currentY, { align: 'right' });
  }
  
  return currentY + settings.spacing.section;
};

// Client section
const renderClientSection = (doc: jsPDF, settings: any, documentData: any, startY: number) => {
  let currentY = startY;
  
  // Client label
  doc.setFontSize(settings.fonts.heading.size);
  doc.setTextColor(...hexToRgb(settings.colors.primary));
  doc.setFont('helvetica', 'bold');
  
  const clientLabel = documentData.type === 'commande' ? 'FOURNISSEUR' : 
                     documentData.type === 'bonLivraison' ? 'DESTINATAIRE' : 'CLIENT';
  doc.text(clientLabel, settings.margins.left, currentY);
  currentY += settings.spacing.element;
  
  // Client details
  doc.setFontSize(settings.fonts.body.size);
  doc.setTextColor(...hexToRgb(settings.fonts.body.color));
  
  const clientEntity = documentData.type === 'commande' ? documentData.fournisseur : documentData.client;
  
  // Client name in bold
  doc.setFont('helvetica', 'bold');
  doc.text(clientEntity.nom, settings.margins.left, currentY);
  currentY += settings.spacing.line;
  
  // Client details in normal weight
  doc.setFont('helvetica', 'normal');
  const clientLines = [
    documentData.type !== 'commande' && clientEntity.code ? `Code: ${clientEntity.code}` : '',
    clientEntity.matriculeFiscal ? `Matricule Fiscal: ${clientEntity.matriculeFiscal}` : '',
    clientEntity.adresse,
    `${clientEntity.codePostal} ${clientEntity.ville}`,
    clientEntity.telephone ? `Tél: ${clientEntity.telephone}` : ''
  ].filter(line => line.trim());
  
  clientLines.forEach(line => {
    if (line) {
      doc.text(line, settings.margins.left, currentY);
      currentY += settings.spacing.line;
    }
  });
  
  return currentY + settings.spacing.section;
};

// Enhanced table with optimized width distribution and centering
const renderEnhancedTable = (doc: jsPDF, settings: any, documentData: any, startY: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const availableWidth = pageWidth - settings.margins.left - settings.margins.right;
  
  // Table format without FODEC column (FODEC is included in calculations but not displayed)
  const tableHeaders = ['Réf', 'Désignation', 'Qté', 'Prix U.', 'Remise', 'Total HT', 'TVA', 'Total TTC'];
  
  // Ensure lignes is an array and has items
  const validLines = Array.isArray(documentData.lignes) ? documentData.lignes.filter((ligne: any) => 
    ligne && 
    ligne.produit && 
    typeof ligne.quantite === 'number'
  ) : [];
  
  let tableData;
  
  if (documentData.type === 'bonLivraison') {
    // For bon de livraison, show all columns with calculated values
    tableData = validLines.map((ligne: any) => [
      ligne.produit.ref || '-',
      ligne.produit.nom,
      ligne.quantite.toString(),
      formatCurrency(ligne.produit.prixUnitaire),
      '0%',
      formatCurrency(ligne.produit.prixUnitaire * ligne.quantite),
      `${ligne.produit.tva}%`,
      formatCurrency(ligne.produit.prixUnitaire * ligne.quantite * (1 + ligne.produit.tva / 100))
    ]);
  } else {
    // For other document types without FODEC column
    tableData = validLines.map((ligne: any) => [
      ligne.produit.ref || '-',
      ligne.produit.nom,
      ligne.quantite.toString(),
      formatCurrency(ligne.prixUnitaire),
      `${ligne.remise || 0}%`,
      formatCurrency(ligne.montantHT),
      `${ligne.produit.tva}%`,
      formatCurrency(ligne.montantTTC)
    ]);
  }
  
  // Optimized column widths for table (8 columns) - using percentage of available width
  const columnStyles = {
    0: { cellWidth: availableWidth * 0.10, halign: 'left' },    // Réf: 10%
    1: { cellWidth: availableWidth * 0.30, halign: 'left' },    // Désignation: 30%
    2: { cellWidth: availableWidth * 0.10, halign: 'center' },  // Qté: 10%
    3: { cellWidth: availableWidth * 0.15, halign: 'right' },   // Prix U.: 15%
    4: { cellWidth: availableWidth * 0.10, halign: 'center' },  // Remise: 10%
    5: { cellWidth: availableWidth * 0.15, halign: 'right' },   // Total HT: 15%
    6: { cellWidth: availableWidth * 0.10, halign: 'center' },  // TVA: 10%
    7: { cellWidth: availableWidth * 0.15, halign: 'right' }    // Total TTC: 15%
  };
  
  // Add a default empty row if no data
  if (!tableData || tableData.length === 0) {
    tableData = [['-', 'Aucun produit', '0', '0.000 TND', '0%', '0.000 TND', '0%', '0.000 TND']];
  }
  
  // Table theme based on settings
  let tableTheme: 'plain' | 'striped' | 'grid' = 'plain';
  if (settings.table.model === 'bordered') {
    tableTheme = 'grid';
  } else if (settings.table.model === 'minimal') {
    tableTheme = 'striped';
  }
  
  autoTable(doc, {
    startY: startY,
    head: [tableHeaders],
    body: tableData,
    theme: tableTheme,
    
    // Center the table and use full available width
    margin: { 
      top: 0, 
      bottom: 0, 
      left: settings.margins.left, 
      right: settings.margins.right 
    },
    tableWidth: 'wrap', // Use available width efficiently
    
    headStyles: {
      fillColor: settings.table.model === 'simple' ? hexToRgb('#f8fafc') : hexToRgb(settings.colors.primary),
      textColor: settings.table.model === 'simple' ? hexToRgb(settings.colors.text) : [255, 255, 255],
      fontSize: settings.table.headerFontSize,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      cellPadding: { top: 2, right: 2, bottom: 2, left: 2 }, // Compact padding
      lineColor: hexToRgb('#d1d5db'),
      lineWidth: 0.2 // Very thin borders
    },
    
    bodyStyles: {
      fontSize: settings.table.fontSize,
      cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 }, // Compact padding
      valign: 'middle',
      lineColor: hexToRgb('#d1d5db'),
      lineWidth: 0.2, // Very thin borders
      textColor: hexToRgb(settings.colors.text),
      minCellHeight: 6 // Minimum row height for compactness
    },
    
    columnStyles,
    
    tableLineColor: hexToRgb('#d1d5db'),
    tableLineWidth: 0.2, // Very thin outer borders
    
    alternateRowStyles: settings.table.model !== 'simple' ? {
      fillColor: hexToRgb('#fafafa')
    } : undefined,
    
    styles: {
      lineColor: hexToRgb('#d1d5db'),
      lineWidth: 0.2, // Very thin borders
      cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 }, // Compact padding
      overflow: 'linebreak',
      cellWidth: 'wrap'
    },
    
    showHead: 'everyPage',
    showFoot: 'never',
    pageBreak: 'auto',
    rowPageBreak: 'auto',
    
    // Ensure table uses full width and is centered
    didParseCell: function (data) {
      // Ensure text wrapping for long content
      if (data.column.index === 1) { // Désignation column
        data.cell.styles.cellWidth = columnStyles[1].cellWidth;
      }
    }
  });
  
  // Return the exact final Y position without any additional spacing
  return (doc as any).lastAutoTable.finalY;
};

// Enhanced totals section
const renderEnhancedTotalsSection = async (doc: jsPDF, settings: any, documentData: any, startY: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  // CRITICAL: Use minimal spacing after table - start immediately after table
  let currentY = startY + 5; // Reduced from settings.spacing.section to just 5mm
  
  // Amount in words (if enabled)
  if (settings.amountInWords.enabled) {
    const amountInWords = numberToWords(documentData.totalTTC, getCurrencySymbol());
    doc.setFontSize(settings.amountInWords.fontSize);
    doc.setTextColor(...hexToRgb(settings.amountInWords.color));
    doc.setFont('helvetica', 'bold');
    
    const amountText = `Arrêté la présente ${documentData.type === 'facture' ? 'facture' : 'document'} à la somme de : ${amountInWords}`;
    const maxWidth = pageWidth - settings.margins.left - settings.margins.right - 90;
    
    let amountX = settings.margins.left;
    if (settings.amountInWords.position === 'right') {
      amountX = pageWidth - settings.margins.right - 90;
    }
    
    const splitAmount = doc.splitTextToSize(amountText, maxWidth);
    doc.text(splitAmount, amountX, currentY);
    
    currentY += splitAmount.length * (settings.amountInWords.fontSize * 0.35) + settings.spacing.element;
  }
  
  // Calculate taxes correctly from lignes AND include settings taxes
  const calculatedTaxes = [];
  const isElectron = typeof window !== 'undefined' && window.electronAPI ? true : false;
  
  // 1. Group taxes by type and rate from product lines (FODEC and TVA)
  const taxGroups = new Map();
  
  if (documentData.lignes && Array.isArray(documentData.lignes)) {
    documentData.lignes.forEach((ligne: any) => {
      if (!ligne.produit) return;
      
      // FODEC calculation
      if (ligne.produit.fodecApplicable && ligne.produit.tauxFodec > 0) {
        const fodecKey = `FODEC_${ligne.produit.tauxFodec}`;
        if (!taxGroups.has(fodecKey)) {
          taxGroups.set(fodecKey, {
            type: 'FODEC',
            rate: ligne.produit.tauxFodec,
            baseAmount: 0,
            taxAmount: 0
          });
        }
        const fodecGroup = taxGroups.get(fodecKey);
        fodecGroup.baseAmount += ligne.montantHT;
        fodecGroup.taxAmount += ligne.montantFodec || (ligne.montantHT * ligne.produit.tauxFodec / 100);
      }
      
      // TVA calculation - SEPARATE BY RATE
      if (ligne.produit.tva > 0) {
        const tvaKey = `TVA_${ligne.produit.tva}`;
        if (!taxGroups.has(tvaKey)) {
          taxGroups.set(tvaKey, {
            type: 'TVA',
            rate: ligne.produit.tva,
            baseAmount: 0,
            taxAmount: 0
          });
        }
        const tvaGroup = taxGroups.get(tvaKey);
        // Calculate base TVA for this specific line
        const lineFodec = ligne.produit.fodecApplicable ? (ligne.montantHT * ligne.produit.tauxFodec / 100) : 0;
        const lineBaseTVA = ligne.montantHT + lineFodec;
        const lineTVA = lineBaseTVA * (ligne.produit.tva / 100);
        
        tvaGroup.baseAmount += lineBaseTVA;
        tvaGroup.taxAmount += lineTVA;
      }
    });
  }
  
  // 2. Add taxes from settings (like Timbre fiscal)
  try {
    if (isElectron && window.electronAPI) {
      const query = window.electronAPI.dbQuery;
      const settingsTaxes = await query(`
        SELECT * FROM taxes 
        WHERE actif = 1 AND json_extract(applicableDocuments, '$') LIKE '%${documentData.type === 'facture' ? 'factures' : documentData.type === 'devis' ? 'devis' : documentData.type === 'bonLivraison' ? 'bonsLivraison' : 'commandesFournisseur'}%'
        ORDER BY ordre ASC
      `);
      
      // Add settings taxes (like Timbre fiscal)
      if (settingsTaxes && settingsTaxes.length > 0) {
        for (const tax of settingsTaxes) {
          // Skip if it's a TVA tax (already calculated from products)
          if (tax.nom.toLowerCase().includes('tva')) continue;
          
          const taxKey = `SETTINGS_${tax.nom}`;
          if (!taxGroups.has(taxKey)) {
            let baseAmount = 0;
            let taxAmount = 0;
            
            if (tax.type === 'fixed') {
              baseAmount = 0;
              taxAmount = tax.valeur;
            } else {
              // Percentage tax
              if (tax.calculationBase === 'totalHT') {
                baseAmount = documentData.totalHT;
              } else {
                // Calculate on HT + previous taxes
                const previousTaxes = Array.from(taxGroups.values()).reduce((sum, group) => sum + group.taxAmount, 0);
                baseAmount = documentData.totalHT + previousTaxes;
              }
              taxAmount = (baseAmount * tax.valeur) / 100;
            }
            
            taxGroups.set(taxKey, {
              type: tax.nom,
              rate: tax.type === 'fixed' ? 0 : tax.valeur,
              baseAmount,
              taxAmount,
              isFixed: tax.type === 'fixed'
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error loading settings taxes:', error);
  }
  
  // 3. Convert tax groups to array and sort by type
  taxGroups.forEach((group) => {
    calculatedTaxes.push({
      nom: group.isFixed ? group.type : `${group.type} ${group.rate}%`,
      base: group.isFixed ? 0 : group.baseAmount,
      taux: group.rate,
      montant: group.taxAmount,
      isFixed: group.isFixed || false
    });
  });
  
  // Sort taxes: FODEC first, then TVA by rate, then other taxes
  calculatedTaxes.sort((a, b) => {
    if (a.nom.includes('FODEC') && !b.nom.includes('FODEC')) return -1;
    if (!a.nom.includes('FODEC') && b.nom.includes('FODEC')) return 1;
    if (a.nom.includes('TVA') && !b.nom.includes('TVA')) return -1;
    if (!a.nom.includes('TVA') && b.nom.includes('TVA')) return 1;
    return a.taux - b.taux;
  });
  
  // Tax details table (if calculated taxes exist)
  if (calculatedTaxes.length > 0) {
    // Tax details table header
    doc.setFontSize(settings.fonts.heading.size);
    doc.setTextColor(...hexToRgb(settings.colors.primary));
    doc.setFont('helvetica', 'bold');
    doc.text('Détail des taxes', settings.margins.left, currentY);
    currentY += settings.spacing.element;
    
    // Prepare tax table data
    const taxTableHeaders = ['Type de taxe', 'Base de calcul', 'Taux (%)', 'Montant'];
    const taxTableData = calculatedTaxes.map((tax: any) => [
      tax.nom,
      tax.isFixed ? '-' : formatCurrency(tax.base),
      tax.isFixed ? 'Fixe' : `${tax.taux}%`,
      formatCurrency(tax.montant)
    ]);
    
    // Render tax table
    autoTable(doc, {
      startY: currentY,
      head: [taxTableHeaders],
      body: taxTableData,
      theme: 'grid',
      margin: { 
        left: settings.margins.left, 
        right: pageWidth - settings.margins.right - 120 // Leave space for totals
      },
      tableWidth: 120, // Fixed width for tax table
      headStyles: {
        fillColor: hexToRgb(settings.colors.primary),
        textColor: [255, 255, 255],
        fontSize: settings.fonts.small.size,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 }
      },
      bodyStyles: {
        fontSize: settings.fonts.small.size - 1,
        cellPadding: { top: 1, right: 2, bottom: 1, left: 2 },
        textColor: hexToRgb(settings.colors.text)
      },
      columnStyles: {
        0: { cellWidth: 35, halign: 'left' },   // Type de taxe
        1: { cellWidth: 30, halign: 'right' },  // Base de calcul
        2: { cellWidth: 20, halign: 'center' }, // Taux
        3: { cellWidth: 35, halign: 'right' }   // Montant
      }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + settings.spacing.element;
  }
  
  // Clean totals - right aligned
  const rightX = pageWidth - settings.margins.right;
  
  doc.setFontSize(settings.fonts.body.size);
  doc.setTextColor(...hexToRgb(settings.fonts.body.color));
  doc.setFont('helvetica', 'normal');
  
  // Total HT
  doc.text(`Total HT:`, rightX - 50, currentY);
  doc.text(formatCurrency(documentData.totalHT), rightX, currentY, { align: 'right' });
  currentY += settings.spacing.line;
  
  // Individual tax lines (same as in tax detail table)
  calculatedTaxes.forEach((tax: any) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...hexToRgb(settings.fonts.body.color));
    doc.text(`${tax.nom}:`, rightX - 50, currentY);
    doc.text(formatCurrency(tax.montant), rightX, currentY, { align: 'right' });
    currentY += settings.spacing.line;
  });
  
  // Total TTC - emphasized
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(settings.fonts.heading.size);
  doc.setTextColor(...hexToRgb(settings.colors.primary));
  
  // Calculate correct TTC including all taxes
  const totalCalculatedTaxes = calculatedTaxes.reduce((sum, tax) => sum + tax.montant, 0);
  const correctTotalTTC = documentData.totalHT + totalCalculatedTaxes;
  
  doc.text(`Total TTC:`, rightX - 50, currentY);
  doc.text(formatCurrency(correctTotalTTC), rightX, currentY, { align: 'right' });
  
  return currentY + settings.spacing.section;
};

// Enhanced footer with customizable styling
const renderEnhancedFooter = (doc: jsPDF, settings: any, notes?: string) => {
  if (!settings.footer.enabled) return;
  
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  let footerY = pageHeight - settings.margins.bottom - 15;
  
  // Notes if provided
  if (notes && notes.trim()) {
    footerY -= 15;
    
    doc.setFontSize(settings.fonts.body.size);
    doc.setTextColor(...hexToRgb(settings.fonts.body.color));
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', settings.margins.left, footerY);
    
    doc.setFont('helvetica', 'normal');
    const maxWidth = pageWidth - settings.margins.left - settings.margins.right;
    const splitNotes = doc.splitTextToSize(notes, maxWidth);
    doc.text(splitNotes, settings.margins.left, footerY + 5);
    
    footerY -= splitNotes.length * 3;
  }
  
  // Footer line
  const finalFooterY = pageHeight - settings.margins.bottom - 8;
  
  doc.setDrawColor(...hexToRgb(settings.colors.border));
  doc.setLineWidth(0.5);
  doc.line(settings.margins.left, finalFooterY, pageWidth - settings.margins.right, finalFooterY);
  
  // Footer text with custom styling
  doc.setFontSize(settings.footer.fontSize);
  doc.setTextColor(...hexToRgb(settings.footer.color));
  doc.setFont('helvetica', settings.footer.fontWeight);
  
  let footerX: number;
  switch (settings.footer.position) {
    case 'center':
      footerX = pageWidth / 2;
      doc.text(settings.footer.text, footerX, finalFooterY + 5, { align: 'center' });
      break;
    case 'right':
      footerX = pageWidth - settings.margins.right;
      doc.text(settings.footer.text, footerX, finalFooterY + 5, { align: 'right' });
      break;
    case 'left':
    default:
      footerX = settings.margins.left;
      doc.text(settings.footer.text, footerX, finalFooterY + 5);
      break;
  }
  
  // Custom footer text
  if (settings.footer.customText && settings.footer.customText.trim()) {
    const customY = finalFooterY + 5 + (settings.footer.fontSize * 0.35);
    switch (settings.footer.position) {
      case 'center':
        doc.text(settings.footer.customText, pageWidth / 2, customY, { align: 'center' });
        break;
      case 'right':
        doc.text(settings.footer.customText, pageWidth - settings.margins.right, customY, { align: 'right' });
        break;
      case 'left':
      default:
        doc.text(settings.footer.customText, settings.margins.left, customY);
        break;
    }
  }
  
  // Date if enabled
  if (settings.footer.showDate) {
    const dateText = `Document généré le ${formatDate(new Date())}`;
    const dateY = finalFooterY + 5 + (settings.footer.fontSize * 0.35) + (settings.footer.customText ? (settings.footer.fontSize * 0.35) : 0);
    
    switch (settings.footer.position) {
      case 'center':
        doc.text(dateText, pageWidth / 2, dateY, { align: 'center' });
        break;
      case 'left':
        doc.text(dateText, pageWidth - settings.margins.right, dateY, { align: 'right' });
        break;
      case 'right':
      default:
        doc.text(dateText, settings.margins.left, dateY);
        break;
    }
  }
};

// CRITICAL: New function to render a complete invoice on an existing PDF document
const renderInvoiceOnExistingDocument = async (
  doc: jsPDF, 
  documentData: any, 
  documentTitle: string,
  settings: any,
  companyInfo: any,
  logoUrl?: string
) => {
  // Render document sections with enhanced styling on the current page
  let currentY = renderEnhancedHeader(doc, settings, companyInfo, logoUrl);
  currentY = renderEnhancedTitle(doc, settings, documentTitle, documentData, currentY);
  currentY = renderClientSection(doc, settings, documentData, currentY);
  currentY = renderEnhancedTable(doc, settings, documentData, currentY);
  currentY = await renderEnhancedTotalsSection(doc, settings, documentData, currentY);
  renderEnhancedFooter(doc, settings, documentData.notes);
  
  return doc;
};

// Main enhanced document generation function
const generateEnhancedDocument = async (documentData: any, documentTitle: string) => {
  try {
    const doc = new jsPDF();
    const isElectron = typeof window !== 'undefined' && window.electronAPI ? true : false;
    const query = isElectron ? window.electronAPI.dbQuery : undefined;
    
    // Load settings and logo
    const settings = await getTemplateSettings(isElectron, query);
    const logoUrl = await getTemplateLogo(isElectron, query);
    
    // Get company info
    const companyInfo = await getCompanyInfo(isElectron, query);
    
    // Ensure lignes is an array
    if (!Array.isArray(documentData.lignes)) {
      console.warn('Document lignes is not an array, initializing empty array');
      documentData.lignes = [];
    }
    
    // Render document sections with enhanced styling
    let currentY = renderEnhancedHeader(doc, settings, companyInfo, logoUrl);
    currentY = renderEnhancedTitle(doc, settings, documentTitle, documentData, currentY);
    currentY = renderClientSection(doc, settings, documentData, currentY);
    currentY = renderEnhancedTable(doc, settings, documentData, currentY);
    currentY = await renderEnhancedTotalsSection(doc, settings, documentData, currentY);
    renderEnhancedFooter(doc, settings, documentData.notes);
    
    return doc;
  } catch (error) {
    console.error('Error generating PDF document:', error);
    throw new Error(`Erreur lors de la génération du PDF: ${error}`);
  }
};

// CRITICAL: New function to create combined PDF with proper template for all pages
export const generateCombinedFacturesPDF = async (factures: Facture[]) => {
  if (factures.length === 0) {
    throw new Error('No invoices provided');
  }

  try {
    const isElectron = typeof window !== 'undefined' && window.electronAPI ? true : false;
    const query = isElectron ? window.electronAPI.dbQuery : undefined;
    
    // Load settings and resources once for efficiency
    const settings = await getTemplateSettings(isElectron, query);
    const logoUrl = await getTemplateLogo(isElectron, query);
    const companyInfo = await getCompanyInfo(isElectron, query);
    
    // Create the first invoice using the proper template
    const firstFactureData = { ...factures[0], type: 'facture' };
    
    // Ensure lignes is an array
    if (!Array.isArray(firstFactureData.lignes)) {
      console.warn('First facture lignes is not an array, initializing empty array');
      firstFactureData.lignes = [];
    }
    
    const combinedDoc = await generateEnhancedDocument(firstFactureData, 'FACTURE');
    
    // Add each subsequent invoice as a new page with full template
    for (let i = 1; i < factures.length; i++) {
      const facture = factures[i];
      const factureData = { ...facture, type: 'facture' };
      
      // Ensure lignes is an array
      if (!Array.isArray(factureData.lignes)) {
        console.warn(`Facture ${i} lignes is not an array, initializing empty array`);
        factureData.lignes = [];
      }
      
      // Add a new page
      combinedDoc.addPage();
      
      // Set to the new page
      combinedDoc.setPage(combinedDoc.internal.getNumberOfPages());
      
      // Render the complete invoice with full template on this page
      await renderInvoiceOnExistingDocument(
        combinedDoc,
        factureData,
        'FACTURE',
        settings,
        companyInfo,
        logoUrl
      );
    }
    
    return combinedDoc;
  } catch (error) {
    console.error('Error generating combined PDF:', error);
    throw new Error(`Erreur lors de la génération du PDF combiné: ${error}`);
  }
};

export const generateFacturePDF = async (facture: Facture) => {
  try {
    // Ensure lignes is an array
    if (!Array.isArray(facture.lignes)) {
      console.warn('Facture lignes is not an array, initializing empty array');
      facture.lignes = [];
    }
    
    // CRITICAL FIX: Don't prepare taxes array - let the PDF generator calculate from lignes
    const documentData = {
      ...facture,
      type: 'facture'
    };
    
    return await generateEnhancedDocument(documentData, 'FACTURE');
  } catch (error) {
    console.error('Error generating facture PDF:', error);
    throw new Error(`Erreur lors de la génération du PDF de facture: ${error}`);
  }
};

export const generateDevisPDF = async (devis: Devis) => {
  try {
    // Ensure lignes is an array
    if (!Array.isArray(devis.lignes)) {
      console.warn('Devis lignes is not an array, initializing empty array');
      devis.lignes = [];
    }
    
    // CRITICAL FIX: Don't prepare taxes array - let the PDF generator calculate from lignes
    const documentData = {
      ...devis,
      type: 'devis'
    };
    
    return await generateEnhancedDocument(documentData, 'DEVIS');
  } catch (error) {
    console.error('Error generating devis PDF:', error);
    throw new Error(`Erreur lors de la génération du PDF de devis: ${error}`);
  }
};

export const generateBonLivraisonPDF = async (bonLivraison: BonLivraison) => {
  try {
    // Ensure lignes is an array
    if (!Array.isArray(bonLivraison.lignes)) {
      console.warn('BonLivraison lignes is not an array, initializing empty array');
      bonLivraison.lignes = [];
    }
    
    // CRITICAL FIX: Don't prepare taxes array - let the PDF generator calculate from lignes
    const documentData = {
      ...bonLivraison,
      type: 'bonLivraison'
    };
    
    return await generateEnhancedDocument(documentData, 'BON DE LIVRAISON');
  } catch (error) {
    console.error('Error generating bon de livraison PDF:', error);
    throw new Error(`Erreur lors de la génération du PDF de bon de livraison: ${error}`);
  }
};

export const generateCommandeFournisseurPDF = async (commande: CommandeFournisseur) => {
  try {
    // Ensure lignes is an array
    if (!Array.isArray(commande.lignes)) {
      console.warn('Commande lignes is not an array, initializing empty array');
      commande.lignes = [];
    }
    
    // CRITICAL FIX: Don't prepare taxes array - let the PDF generator calculate from lignes
    const documentData = {
      ...commande,
      type: 'commande'
    };
    
    return await generateEnhancedDocument(documentData, 'COMMANDE FOURNISSEUR');
  } catch (error) {
    console.error('Error generating commande fournisseur PDF:', error);
    throw new Error(`Erreur lors de la génération du PDF de commande fournisseur: ${error}`);
  }
};