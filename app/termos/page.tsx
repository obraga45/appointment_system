import { LegalPage } from "@/components/legal-page";
import { BRAND } from "@/lib/brand";

export default function TermosPage() {
  return (
    <LegalPage title="Termos de utilização">
      <p>
        O {BRAND.name} ({BRAND.domain}) é um serviço de gestão de marcações para estabelecimentos. Ao
        criar conta, o profissional (o «Cliente») aceita estes termos.
      </p>
      <p>
        O plano é de {BRAND.monthlyPrice}/mês ou {BRAND.yearlyPrice} no primeiro ano (pagamento único
        do período). O primeiro pagamento faz-se por MB Way ou transferência, com comprovativo para{" "}
        <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${BRAND.email}`}>
          {BRAND.email}
        </a>
        . O débito automático mensal poderá ser oferecido mais tarde. Não há fidelização para além do
        período já pago.
      </p>
      <p>
        O Cliente é responsável pelos serviços, horários, marcações e comunicações enviadas aos seus
        utentes. Os dados dos utentes (nome, telemóvel, email) são tratados em nome do Cliente, que
        actua como responsável pelo tratamento.
      </p>
      <p>
        O Cliente pode pedir um sinal (valor fixo) para confirmar marcações feitas pelo link público.
        Esse valor é pago pelo utente directamente ao estabelecimento (por exemplo MB Way ou
        transferência). O {BRAND.name} não recebe, não transita e não reembolsa estes pagamentos. O
        horário fica reservado durante um período limitado até o Cliente confirmar no painel; se o
        sinal não for confirmado a tempo, a reserva caduca e o horário volta a ficar livre. A política
        de cancelamento e de perda do sinal é definida pelo estabelecimento.
      </p>
      <p>
        As confirmações e lembretes são enviados pelo WhatsApp do próprio negócio. O Cliente
        reconhece que estas redes são de terceiros e que a entrega das mensagens não pode ser
        garantida a 100%.
      </p>
      <p>
        É proibido usar a plataforma para spam, fraude ou tratamento ilícito de dados pessoais. Podemos
        suspender contas que violem estes termos, que não paguem o serviço ou que ponham em risco a
        infra-estrutura.
      </p>
      <p>
        O serviço é prestado «tal como está». Não somos responsáveis por faltas de clientes, falhas de
        rede, bans de WhatsApp ou indisponibilidade de fornecedores externos.
      </p>
      <p>
        Estes termos regem-se pela lei portuguesa. Contacto:{" "}
        <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${BRAND.email}`}>
          {BRAND.email}
        </a>
        .
      </p>
    </LegalPage>
  );
}
