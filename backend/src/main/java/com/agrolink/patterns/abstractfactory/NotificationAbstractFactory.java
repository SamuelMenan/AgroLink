package com.agrolink.patterns.abstractfactory;

/** Abstract Factory: produce sender + formatter family per channel. */
public interface NotificationAbstractFactory {
  MessageFormatter createFormatter();
  MessageSender createSender();

  static NotificationAbstractFactory email(){ return new EmailFactory(); }
  static NotificationAbstractFactory push(){ return new PushFactory(); }
}

interface MessageFormatter { String format(String raw); }
interface MessageSender { void send(String to, String content); }

class EmailFactory implements NotificationAbstractFactory {
  public MessageFormatter createFormatter(){ return raw -> "[EMAIL] " + raw; }
  public MessageSender createSender(){ return (to, content) -> System.out.println("EMAIL to " + to + " => " + content); }
}
class PushFactory implements NotificationAbstractFactory {
  public MessageFormatter createFormatter(){ return raw -> "{\"push\":\"" + raw + "\"}"; }
  public MessageSender createSender(){ return (to, content) -> System.out.println("PUSH to " + to + " => " + content); }
}
