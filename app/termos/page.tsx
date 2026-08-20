import { LegalPage } from "@/components/legal-page";

export default function TermosPage() {
  return (
    <LegalPage title="Termos de utilização">
      <p>
        O MarcaJá é um serviço de gestão de marcações para estabelecimentos. Ao criar conta, o profissional
        (o «Cliente») aceita estes termos.
      </p>
      <p>
        O Cliente é responsável pelos serviços, horários, marcações e comunicações enviadas aos seus
        utentes. Os dados dos utentes (nome, telemóvel, email) são tratados em nome do Cliente, que
        actua como responsável pelo tratamento.
      </p>
      <p>
        As confirmações e lembretes são enviados por WhatsApp ou SMS através de fornecedores técnicos
        (por exemplo Evolution API, Z-API ou Twilio). O Cliente reconhece que estas redes são de
        terceiros e que a entrega das mensagens não pode ser garantida a 100%.
      </p>
      <p>
        É proibido usar a plataforma para spam, fraude ou tratamento ilícito de dados pessoais. Podemos
        suspender contas que violem estes termos ou que ponham em risco a infra-estrutura.
      </p>
      <p>
        O serviço é prestado «tal como está». Não somos responsáveis por faltas de clientes, falhas de
        rede, bans de WhatsApp ou indisponibilidade de fornecedores externos.
      </p>
      <p>
        Estes termos regem-se pela lei portuguesa. Para questões: use o email com que se registou ou o
        contacto indicado no site.
      </p>
    </LegalPage>
  );
}
