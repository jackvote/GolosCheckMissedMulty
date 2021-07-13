// Скрипт проверки пропущенных блоков на нескольких нодах

// --- необходимые библиотеки устанавливаются через npm
const golos = require("golos-classic-js")
const request = require("request")
// Подключение api-node
//const GOLOSNODE = "ws://192.168.1.220:8090" // local node
const GOLOSNODE = "wss://golos.lexai.host/ws" // public node
golos.config.set('websocket', GOLOSNODE)

// Настройки скрипта

var timeout=28 // sec период проверки работоспособности (учитывайте нагрузку на паблик-ноду)
var timewait=10*60 // sec время ожидания восстановления работоспособности до активации
var keyoff="GLS1111111111111111111111111111111114T1Anm"

// Ноды для мониторинга

var users= {
    "retroscope": [
        "5Asdfg...",  // Активный ключ
        "https://golos.id/ru--zhiznx/@retroscope/nachni-svoi-den-chashechkoi-kofe",   // URL заявления о намерениях
        "GLS5m14X9UrUkZUM67A546ak6CezBKce3TbYrMJQFXqGKDSmQNN9B", // Публичный ключ подписи
        0, // пропущено блоков
        0  // время деактивации ноды
        ],

    "jackvote": [
        "5Qwerty...",
        "https://golos.id/ru--delegat/@jackvote/jackvote---v-delegaty",   // URL заявления о намерениях
        "GLS7PGuVBUCVcRmm9eFrYQu99oPHxGTV18BbJszNDsGs5v8vANx8k", // Публичный ключ подписи
        0, // пропущено блоков
        0  // время деактивации ноды
        ]
    }

// =======================================================================
console.log("Start monitoring")

function checkAll() {
    let delay=0
    for (let owner in users) {
        setTimeout(checkMissed, delay, owner) // разносим по времени запросы к апи-ноде
        delay+=1000
    }
}

function checkMissed(owner) {

    golos.api.getWitnessByAccount(owner, function(err,result){
        if (err) {
            console.log(err)
            return
        }
        if (result==null) { // если указанный аккаунт не является нодой
            console.log(owner, "not witness - deleted from list")
            delete users[owner] // убираем из списка и работаем с остальными
            return
        }
        let time=parseInt(new Date().getTime()/1000) // unixtimestamp
        if (result.signing_key==keyoff) { // отключена ли нода
            disable=true
        } else {
            disable=false
        }

// получем данные ранее установленные для делегата
        let props={ account_creation_fee: result.props.account_creation_fee,
                    maximum_block_size: result.props.maximum_block_size,
                    sbd_interest_rate: result.props.sbd_interest_rate
                }
        let [wif, url, keyon, missed, timeoff] = users[owner]

        if (users[owner][3]==0) { // начальная инициализация счётчика при запуске скрипта
            users[owner][3]=result.total_missed
            console.log(owner, Date(), "Set current:", result.total_missed)
            return
        }
        if (result.total_missed>missed && disable==false) { // если счётчик увеличился, а нода не отключена
            users[owner][3]=result.total_missed
            setkey(disable, owner, props) // отключаем
            users[owner][4]=time // заносим время отключения
            return
        }
        if (result.total_missed>missed && disable && (time-timeoff)<timewait) { // если счётчик увеличился, а нода отключена
            users[owner][3]=result.total_missed
            console.log(Date(), "Disable now:", missed)
            return
        }
        if (result.total_missed==missed && disable && time-timeoff>=timewait) { // счётчик не изменился с момента проверки - включай
            setkey(disable, owner, props) // включаем
            users[owner][4]=0 // пофиг
            return
        }
    });
}

function setkey(action, owner, props) {
  try {
    let [wif, url, keyon, missed, timeoff] = users[owner]
    let key=keyoff
    if (action) {
        key=keyon
        func="Enable"
    } else {
        func="Disable"
    }

    golos.broadcast.witnessUpdate(wif,owner,url,key,props,"0.000 GOLOS",function(err,result){
        if (err) {
            console.log(err)
            return
        }
        console.log(Date(), owner+" | "+func+" witness:", missed)
    });
  } catch (err) {
    console.log("SetKey >>>", e.name)
  }
}

/// Основной цикл
const startCheck = () => {

    timerCheckOff = setInterval(()=>{
        checkAll()
    }, timeout*1000)
}

const startBot = () => {
    checkAll()
    startCheck()
}

startBot() // запуск скрипта
