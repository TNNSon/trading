export interface IButton {
    "type":IButtonType,
    "url":"https://petersfancybrownhats.com",
    "title":"View Website",

    "payload":"DEVELOPER_DEFINED_PAYLOAD"
}

export interface IButtonType {
    WEB_URL : "web_url";
    POSTBACK : "postback";
}