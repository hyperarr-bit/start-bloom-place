// Snapshot de dados reais de uma conta interna, usado como seed do demo de
// Finanças (/preview/financas). O formato é idêntico ao que o app grava, então
// o módulo renderiza sem NaN / Invalid Date e a aba de Investimentos abre.
// Para regenerar: rode o app com uma conta de exemplo e exporte as chaves finance-*.
/* eslint-disable */
export const FINANCAS_SEED: Record<string, any> = {
  "finance-last-seen-month": "Junho-2026",
  "finance-incomes": [
    {
      "id": "1780076719780",
      "date": "2026-05-29",
      "value": 3000,
      "description": "Salário"
    }
  ],
  "finance-goals": [
    {
      "id": "g-1",
      "name": "Reserva de emergência",
      "deadline": "2027-05-02",
      "targetValue": 30000,
      "currentValue": 18500
    },
    {
      "id": "g-2",
      "name": "Viagem Fernando de Noronha",
      "deadline": "2026-08-30",
      "targetValue": 8000,
      "currentValue": 3200
    },
    {
      "id": "g-3",
      "name": "Trocar de carro",
      "deadline": "2028-05-02",
      "targetValue": 45000,
      "currentValue": 12000
    }
  ],
  "finance-wishlist": [
    {
      "id": "1779405977217",
      "link": "https://www.amazon.com.br/Apple-2025-iPad-Wi-Fi-128/dp/B0DZK3M8GJ/ref=asc_df_B0DZK3M8GJ?mcid=dde4ecf83ad83170b55c0ad1dd5c7010&tag=googleshopp06-20&linkCode=df0&hvadid=709883750146&hvpos=&hvnetw=g&hvrand=16339597187580089015&hvpone=&hvptwo=&hvqmt=&hvdev=m&hvdvcmdl=&hvlocint=&hvlocphy=9229461&hvtargid=pla-2423897514901&psc=1&hvocijid=16339597187580089015-B0DZK3M8GJ-&hvexpln=0&language=pt_BR",
      "name": "Apple 2025 iPad (Wi-Fi, 128 GB) - Prateado (A16)",
      "price": 3399,
      "category": "Outros",
      "imageUrl": "https://m.media-amazon.com/images/I/41kLdymn2jL.jpg",
      "priority": "media",
      "savedAmount": 1200
    }
  ],
  "finance-monthly-budgets": [
    {
      "month": "Janeiro",
      "value": 5500,
      "hasNote": false
    },
    {
      "month": "Fevereiro",
      "value": 5500,
      "hasNote": false
    },
    {
      "month": "Março",
      "value": 5500,
      "hasNote": false
    },
    {
      "month": "Abril",
      "value": 5500,
      "hasNote": false
    },
    {
      "month": "Maio",
      "value": 5500,
      "hasNote": false
    },
    {
      "month": "Junho",
      "value": 5500,
      "hasNote": false
    },
    {
      "month": "Julho",
      "value": 5500,
      "hasNote": false
    },
    {
      "month": "Agosto",
      "value": 5500,
      "hasNote": false
    },
    {
      "month": "Setembro",
      "value": 5500,
      "hasNote": false
    },
    {
      "month": "Outubro",
      "value": 5500,
      "hasNote": false
    },
    {
      "month": "Novembro",
      "value": 5500,
      "hasNote": false
    },
    {
      "month": "Dezembro",
      "value": 5500,
      "hasNote": false
    }
  ],
  "finance-annual": [
    {
      "month": "Janeiro",
      "dividas": 1248,
      "receitas": 8880,
      "custosFixos": 2760,
      "custosVariaveis": 1591
    },
    {
      "month": "Fevereiro",
      "dividas": 1248,
      "receitas": 8880,
      "custosFixos": 2760,
      "custosVariaveis": 1591
    },
    {
      "month": "Março",
      "dividas": 1248,
      "receitas": 8880,
      "custosFixos": 2760,
      "custosVariaveis": 1591
    },
    {
      "month": "Abril",
      "dividas": 1248,
      "receitas": 8880,
      "custosFixos": 2760,
      "custosVariaveis": 1591
    },
    {
      "month": "Maio",
      "dividas": 1248,
      "receitas": 8880,
      "custosFixos": 2760,
      "custosVariaveis": 1591
    },
    {
      "month": "Junho",
      "dividas": 1248,
      "receitas": 8880,
      "custosFixos": 2760,
      "custosVariaveis": 1591
    },
    {
      "month": "Julho",
      "dividas": 1248,
      "receitas": 8880,
      "custosFixos": 2760,
      "custosVariaveis": 1591
    },
    {
      "month": "Agosto",
      "dividas": 1248,
      "receitas": 8880,
      "custosFixos": 2760,
      "custosVariaveis": 1591
    },
    {
      "month": "Setembro",
      "dividas": 1248,
      "receitas": 8880,
      "custosFixos": 2760,
      "custosVariaveis": 1591
    },
    {
      "month": "Outubro",
      "dividas": 1248,
      "receitas": 8880,
      "custosFixos": 2760,
      "custosVariaveis": 1591
    },
    {
      "month": "Novembro",
      "dividas": 1248,
      "receitas": 8880,
      "custosFixos": 2760,
      "custosVariaveis": 1591
    },
    {
      "month": "Dezembro",
      "dividas": 1248,
      "receitas": 8880,
      "custosFixos": 2760,
      "custosVariaveis": 1591
    }
  ],
  "finance-trips": [],
  "finance-2026-abril-fixed": [
    {
      "id": "1779404215455",
      "value": 1300,
      "category": "moradia",
      "description": "1300",
      "paymentMethod": "boleto"
    },
    {
      "id": "1779404229570",
      "value": 1200,
      "category": "educacao",
      "description": "1200",
      "paymentMethod": "boleto"
    },
    {
      "id": "1779404243362",
      "value": 250,
      "category": "pets",
      "description": "T",
      "paymentMethod": "boleto"
    },
    {
      "id": "1779404275453",
      "value": 399,
      "category": "contas_casa",
      "description": "399",
      "paymentMethod": "boleto"
    },
    {
      "id": "1779404284686",
      "value": 128,
      "category": "assinaturas",
      "description": "120",
      "paymentMethod": "boleto"
    }
  ],
  "finance-investments": [
    {
      "id": "1779402766165",
      "name": "Tesouro Selic ",
      "type": "renda_fixa",
      "startDate": "2026-03-01",
      "currentValue": 14500,
      "expectedReturn": 13,
      "investedAmount": 13500,
      "monthlyContribution": 500
    }
  ],
  "finance-streak": 23,
  "finance-lastCheckIn": "2026-05-02",
  "finance-2026-abril-expenses": [
    {
      "id": "1779404308691",
      "date": "2026-05-21",
      "value": 150,
      "category": "vestuario",
      "description": "T",
      "paymentMethod": "pix"
    },
    {
      "id": "1779404364050",
      "date": "2026-05-21",
      "value": 58,
      "category": "restaurante",
      "description": "T",
      "paymentMethod": "pix"
    },
    {
      "id": "1779404382619",
      "date": "2026-05-21",
      "value": 80,
      "category": "delivery",
      "description": "U",
      "paymentMethod": "pix"
    },
    {
      "id": "1779404403921",
      "date": "2026-05-21",
      "value": 200,
      "category": "presente",
      "description": "200",
      "paymentMethod": "pix"
    }
  ],
  "finance-notes": [
    {
      "id": "n-1",
      "text": "Renegociar plano da internet — promoção até dia 25"
    },
    {
      "id": "n-2",
      "text": "Aportar R$ 500 no Tesouro Selic dia 30"
    },
    {
      "id": "n-3",
      "text": "Conferir fatura do cartão antes de vencer"
    },
    {
      "id": "n-4",
      "text": "Cancelar assinatura do app de produtividade que não uso"
    }
  ],
  "finance-installments": [
    {
      "id": "1778282128840",
      "date": "2026-05-26",
      "cardName": "nubank",
      "category": "eletronicos",
      "totalValue": 5000,
      "description": "iPhone 16",
      "installmentValue": 416.6666666666667,
      "paidInstallments": 9,
      "totalInstallments": 12
    }
  ],
  "finance-2026-abril-incomes": [
    {
      "id": "1779756472842",
      "date": "2026-05-26",
      "value": 4567,
      "description": "4567"
    }
  ],
  "finance-category-budgets": {
    "pets": 126,
    "Lazer": 400,
    "Saúde": 600,
    "moradia": 1400,
    "academia": 150,
    "delivery": 79,
    "educacao": 580,
    "vestuario": 980,
    "Educação": 300,
    "Transporte": 500,
    "Vestuário": 250,
    "transporte": 250,
    "combustivel": 60,
    "contas_casa": 230,
    "restaurante": 150,
    "Alimentação": 1200,
    "internet_telefone": 90
  },
  "finance-2026-marco-incomes": [
    {
      "id": "1779230821625",
      "date": "2026-05-19",
      "value": 5000,
      "description": "5000"
    }
  ],
  "finance-2026-marco-fixed": [
    {
      "id": "1779233409212",
      "value": 2450,
      "category": "moradia",
      "description": "2450",
      "paymentMethod": "pix"
    }
  ],
  "finance-expenses": [
    {
      "id": "6fc27fc6-435f-44c0-90f9-5e453b60a33f",
      "date": "2026-05-05",
      "value": 50,
      "category": "transporte",
      "description": "Transporte",
      "paymentMethod": "pix"
    },
    {
      "id": "1778281900210",
      "date": "2026-05-01",
      "value": 65,
      "category": "delivery",
      "description": "IFood ",
      "paymentMethod": "pix"
    },
    {
      "id": "1778281948773",
      "date": "2026-05-02",
      "value": 220,
      "cardName": "nubank",
      "category": "vestuario",
      "description": "Camisas berzerk",
      "paymentMethod": "credito"
    },
    {
      "id": "1778281973066",
      "date": "2026-05-08",
      "value": 180,
      "category": "restaurante",
      "description": "Coco bambu ",
      "paymentMethod": "pix"
    },
    {
      "id": "1778282053294",
      "date": "2026-05-06",
      "value": 120,
      "cardName": "inter",
      "category": "pets",
      "description": "Veterinário ",
      "paymentMethod": "debito"
    },
    {
      "id": "1781125683004",
      "date": "2026-06-10",
      "value": 60,
      "cardName": "inter",
      "category": "farmacia",
      "description": "Remédio ",
      "paymentMethod": "credito"
    }
  ],
  "finance-fixed-expenses": [
    {
      "id": "1777945886358",
      "value": 1300,
      "cardName": "inter",
      "category": "moradia",
      "description": "Aluguel ",
      "paymentMethod": "debito"
    },
    {
      "id": "1777945908679",
      "value": 70,
      "category": "internet_telefone",
      "description": "Net claro ",
      "paymentMethod": "pix"
    },
    {
      "id": "1777946013931",
      "value": 450,
      "category": "educacao",
      "description": "Curso de inglês ",
      "paymentMethod": "pix"
    },
    {
      "id": "1777946046961",
      "value": 180,
      "category": "contas_casa",
      "description": "Luz ",
      "paymentMethod": "pix"
    },
    {
      "id": "1777946112616",
      "value": 45,
      "category": "contas_casa",
      "description": "Água ",
      "paymentMethod": "pix"
    },
    {
      "id": "1780109181071",
      "value": 158,
      "category": "academia",
      "description": "Academia",
      "paymentMethod": "boleto"
    },
    {
      "id": "1781566529869",
      "value": 2358,
      "category": "outros",
      "description": "Malha fina receita ",
      "paymentMethod": "boleto"
    }
  ],
  "finance-dueDays": [
    {
      "day": 5,
      "bills": [
        {
          "id": "b1",
          "name": "Aluguel",
          "paid": true,
          "value": 1800
        },
        {
          "id": "b2",
          "name": "Plano de Saúde",
          "paid": true,
          "value": 420
        }
      ],
      "color": "yellow"
    },
    {
      "day": 18,
      "bills": [
        {
          "id": "b3",
          "name": "Internet",
          "paid": false,
          "value": 120
        },
        {
          "id": "1778367404676",
          "name": "Academia ",
          "paid": false
        }
      ],
      "color": "slate"
    },
    {
      "day": 22,
      "bills": [
        {
          "id": "b5",
          "name": "Netflix",
          "paid": false,
          "value": 39.9
        },
        {
          "id": "b6",
          "name": "Spotify",
          "paid": false,
          "value": 21.9
        },
        {
          "id": "b7",
          "name": "Água",
          "paid": false,
          "value": 80
        }
      ],
      "color": "indigo"
    },
    {
      "day": 27,
      "bills": [
        {
          "id": "b8",
          "name": "Cartão Nubank",
          "paid": false,
          "value": 1240
        },
        {
          "id": "1779402684354",
          "name": "Netflix",
          "paid": false
        }
      ],
      "color": "emerald"
    },
    {
      "day": 1,
      "bills": [
        {
          "id": "1778367353072",
          "name": "YouTube Music ",
          "paid": true
        },
        {
          "id": "1778367379814",
          "name": "Fatura cartão inter",
          "paid": true
        }
      ],
      "color": ""
    }
  ]
};
