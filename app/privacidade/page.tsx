import { LegalPage } from "@/components/legal-page";

export default function PrivacidadePage() {
  return (
    <LegalPage title="Política de privacidade">
      <p>
        Tratamos dados pessoais para prestar o serviço de marcações, nos termos do RGPD e da Lei n.º
        58/2019.
      </p>
      <p>
        <strong className="text-foreground">Contas de profissionais:</strong> nome, email, telemóvel,
        nome do negócio, fuso horário e palavra-passe (armazenada de forma irreversível). Base legal:
        execução do contrato.
      </p>
      <p>
        <strong className="text-foreground">Dados dos utentes:</strong> recolhidos pelo estabelecimento
        (nome, telemóvel, email opcional, serviço e horário). O MarcaJá trata estes dados como
        subcontratante do estabelecimento. Conservam-se enquanto a conta estiver activa e o tempo
        necessário para a agenda.
      </p>
      <p>
        <strong className="text-foreground">Comunicações:</strong> o telemóvel é usado para enviar
        confirmação, lembretes e o link de cancelamento. O número pode ser transmitido ao fornecedor
        de mensagens escolhido.
      </p>
      <p>
        Alojamos a aplicação e a base de dados na União Europeia (por exemplo Vercel e Hetzner). Os
        fornecedores de WhatsApp/SMS podem tratar números fora da UE; nesse caso aplica-se o capítulo
        V do RGPD.
      </p>
      <p>
        Direitos de acesso, rectificação, apagamento e oposição: o utente deve contactar o
        estabelecimento. O profissional pode pedir a eliminação da conta. Cookies essenciais servem
        apenas a sessão de autenticação.
      </p>
    </LegalPage>
  );
}
