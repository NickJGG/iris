# Iris

A Firefox extension that lets friends send each other YouTube videos, surfaced inside YouTube itself.

## Language

**Iris**:
The extension; also the label for its feed's entry in YouTube's guide sidebar.
_Avoid_: the app, the plugin

**User**:
A person signed in to Iris with a Google account and a **Handle**.
_Avoid_: account, member

**Handle**:
A User's unique `@name`, chosen at first sign-in, and the only thing other Users can search by.
_Avoid_: username, tag

**Friend request**:
A pending invitation from one User to another, found by exact **Handle**.
_Avoid_: invite, follow

**Friend**:
A User with whom you have a mutual friendship, created when a **Friend request** is accepted.
_Avoid_: contact, follower

**Share**:
One YouTube video sent by one User to one Friend, with an optional note and start time, and its own seen state.
_Avoid_: post, message, recommendation

**Watched**:
The state of a Share once its recipient has opened that video anywhere on YouTube; the sender is never told.
_Avoid_: seen, read

**Unsend**:
The sender deleting one of their Shares, removing it from the recipient's Inbox.
_Avoid_: delete, recall

**Feed**:
The Iris page at `youtube.com/feed/iris` where a User sees Shares, with Inbox, Sent and Friends tabs.
_Avoid_: timeline, inbox (that's one tab of the Feed)

**From friends shelf**:
The row of recent incoming Shares at the top of YouTube's home page.
_Avoid_: widget, section

## Relationships

- A **User** has exactly one **Handle**
- A **Friend request** goes from one **User** to one **User**; accepting it makes both **Friends**
- Declining a **Friend request** is silent — the sender keeps seeing it as pending
- Sending one video to three **Friends** creates three **Shares**
- A **Share** can only go to a **Friend**

## Example dialogue

> **Dev:** "Can I find **Sam** by typing 'sa'?"
> **Domain expert:** "No — you need Sam's exact **Handle**, `@sam`. Then you send a **Friend request**, and only once Sam accepts are you **Friends**."

## Flagged ambiguities

- "follow" vs "friend" — resolved: friendship is mutual only; there are no one-way follows.
