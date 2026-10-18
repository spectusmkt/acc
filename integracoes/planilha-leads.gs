/**
 * Cadastro de leads · A Chave da Comunicação
 * Recebe o formulário da página e grava uma linha por cadastro na planilha.
 *
 * Como ativar (uma vez só):
 *  1. Crie uma planilha no Google Sheets (ex.: "Leads · A Chave da Comunicação").
 *  2. Menu Extensões > Apps Script. Apague o que estiver lá e cole este arquivo inteiro.
 *  3. Clique em Implantar > Nova implantação > tipo "App da Web".
 *       Executar como: Eu
 *       Quem pode acessar: Qualquer pessoa
 *     Autorize com a sua conta Google quando pedir.
 *  4. Copie a URL que termina em /exec e cole em PLANILHA_URL, no index.html.
 *
 * A aba "Leads" e o cabeçalho são criados sozinhos no primeiro cadastro.
 * Se alterar este código depois, use Implantar > Gerenciar implantações > Editar >
 * Nova versão, para manter a mesma URL.
 */

var ABA = 'Leads';
var COLUNAS = [
  'Data', 'Nome', 'WhatsApp', 'E-mail', 'Ingresso de interesse', 'Formulário',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
  'fbclid', 'gclid', 'ttclid', 'sck', 'src', 'Página'
];
var CAMPOS = [
  null, 'nome', 'whatsapp', 'email', 'ingresso', 'origem',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
  'fbclid', 'gclid', 'ttclid', 'sck', 'src', 'pagina'
];

function doPost(e) {
  var trava = LockService.getScriptLock();
  trava.waitLock(10000);
  try {
    var planilha = SpreadsheetApp.getActiveSpreadsheet();
    var aba = planilha.getSheetByName(ABA) || planilha.insertSheet(ABA);
    if (aba.getLastRow() === 0) {
      aba.appendRow(COLUNAS);
      aba.setFrozenRows(1);
      aba.getRange(1, 1, 1, COLUNAS.length).setFontWeight('bold');
    }

    var p = (e && e.parameter) || {};
    var linha = CAMPOS.map(function (campo) {
      if (!campo) return new Date();
      // evita que o Sheets interprete o texto como fórmula
      var v = String(p[campo] || '').slice(0, 500);
      return /^[=+\-@]/.test(v) ? "'" + v : v;
    });
    aba.appendRow(linha);

    return ContentService.createTextOutput('ok');
  } finally {
    trava.releaseLock();
  }
}
