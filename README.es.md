# Liangqi · 两讫

> Cuentas claras, deudas saldadas.

**Idiomas:** [简体中文](README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · **Español** · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · [Русский](README.ru.md)

**Aplicación online:** https://arksc.cn:8002/workbook/  
**Código:** [Gitee](https://gitee.com/PharaohMan/liangqi-app) · [GitHub](https://github.com/yejunhui/liangqi-app)  
**Licencia:** AGPL-3.0-or-later

Liangqi es una **aplicación web de contabilidad compartida local-first** que separa los gastos en efectivo de las compras a crédito:

- Los **gastos en efectivo** se descuentan del ahorro de inmediato.
- Las **compras a crédito** no tocan el ahorro: aumentan el pasivo y se reconocen como gasto al pagar la deuda.
- El **pago de una deuda** mueve dinero de activos a pasivos y registra el gasto en ese momento.

Los datos se guardan en el navegador de forma predeterminada. Puedes tener varios libros y conectar un repositorio de GitHub, Gitee o WebDAV para compartir un libro entre varias personas.

![Panel de Liangqi](docs/screenshots/dashboard.png)

## Cómo funciona

| Acción | Activos / ahorro | Pasivos | Gasto |
| --- | ---: | ---: | ---: |
| Compra en efectivo | −100 | 0 | +100 |
| Compra a crédito | 0 | +100 | 0 |
| Pago de deuda | −100 | −100 | +100 |
| Préstamo recibido | +100 | +100 | 0 |

- Una compra a crédito solo aumenta el pasivo; **no cuenta como gasto en el momento de la compra**.
- Al pagar la deuda, el importe pagado se reconoce como gasto.
- Patrimonio neto = activos totales − pasivos totales. Una compra a crédito lo reduce al aumentar el pasivo; el pago no lo cambia.

## Funciones principales

- **Varios libros**: familia, viajes, negocio, etc., con cambio rápido.
- **Cuentas de activo y pasivo**: efectivo, banco, tarjeta de crédito, Huabei, préstamos y saldos iniciales.
- **Facturas**: nombre, categoría, vencimiento, pago parcial y estado.
- **Pagos**: paga desde una cuenta de activo y reduce pasivo y ahorro a la vez.
- **Miembros**: asigna facturas y movimientos a miembros de la familia; en libros compartidos cada persona inicia sesión.
- **Etiquetas y categorías de dos niveles**: etiquetas de contexto, uso y persona; categorías padre/hijo.
- **Presupuestos y movimientos recurrentes**: mensuales o anuales, por categoría, etiqueta o miembro.
- **Importación CSV**: WeChat, Alipay y bancos, con detección automática de columnas.
- **Multidivisa y adjuntos**: tipos de cambio, importe original y archivos de hasta 10 MB.
- **Análisis e informes**: evolución, categorías, etiquetas, miembros, tendencia de 6 meses, CSV y PDF.
- **Asistente AI**: con una API compatible con OpenAI, analiza el libro y propone presupuestos.
- **PWA y offline**: instala en el escritorio o móvil y abre la aplicación sin conexión.
- **10 idiomas**: chino simplificado y tradicional, inglés, japonés, coreano, español, francés, alemán, portugués y ruso.

## Inicio rápido

Usa la aplicación online o ejecútala en local:

```bash
pnpm install
pnpm dev
```

Compilación:

```bash
pnpm build:workbook
```

La guía de despliegue detallada está en [docs/deployment.md](docs/deployment.md) (en chino).

## Datos y privacidad

- El libro se guarda en **IndexedDB** del navegador, con `localStorage` como respaldo.
- Con un remoto, los datos se guardan en tu repositorio de GitHub / Gitee o en tu WebDAV. Liangqi no tiene servidor de datos.
- Las contraseñas de los miembros se guardan solo como **hash PBKDF2**, nunca en texto plano.
- Los tokens y las claves de AI se guardan en el `localStorage` del dispositivo y no pasan por servidores de Liangqi.
- Borrar los datos del navegador elimina el libro local. Exporta copias de seguridad con regularidad.

## Apoyar el proyecto

Si Liangqi te resulta útil, puedes apoyar el desarrollo con Alipay o WeChat:

| Alipay | WeChat |
| --- | --- |
| <img src="public/support/alipay-qr.jpg" alt="QR de Alipay" width="200" /> | <img src="public/support/wechat-qr.jpg" alt="QR de WeChat" width="200" /> |

## Licencia

Publicado bajo **GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later)**. Consulta [LICENSE](LICENSE) para el texto completo.

- Puedes usar, modificar y redistribuir el programa.
- Si distribuyes una versión modificada, debes entregar el código fuente correspondiente y el texto de la licencia.
- Si modificas el programa y lo ofreces a usuarios por red, la sección 13 de la AGPL exige ofrecerles el código fuente correspondiente.
- Las versiones anteriores se publicaron bajo GPL-3.0-or-later. Esas autorizaciones siguen vigentes.

Consulta [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) para las licencias de terceros.

## Aviso

Liangqi es una herramienta de contabilidad, no asesoramiento financiero, fiscal o de inversión. Exporta una copia antes de usarlo. Los autores no se responsabilizan de pérdidas de datos, errores de cálculo o daños derivados del uso del software.
