"""
Database seeder module.
Populates the database with initial dummy users, contacts, conversations, and messages.
Useful for development and testing environments.
"""
import datetime
from sqlalchemy.orm import Session
from backend.app.models import User, Contact, Conversation, ConversationMember, Message, MessageReceipt

def seed_data(db: Session):
    """
    Seed the database with initial mock data.
    Skips seeding if the User table is already populated.
    
    Args:
        db: Database session.
    """
    # Check if data already exists to prevent duplicate seeding
    if db.query(User).count() > 0:
        print("Database already contains data, skipping seed.")
        return

    print("Seeding database...")

    # 1. Create Users
    users_data = [
        {"username": "alice", "display": "Alice Smith", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice"},
        {"username": "bob", "display": "Bob Jones", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob"},
        {"username": "charlie", "display": "Charlie Brown", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie"},
        {"username": "david", "display": "David Miller", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=David"},
        {"username": "eve", "display": "Eve Davis", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Eve"},
        {"username": "frank", "display": "Frank Wilson", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Frank"},
        {"username": "grace", "display": "Grace Taylor", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Grace"}
    ]

    users = []
    for ud in users_data:
        # Mark Alice and Bob as online, others as offline
        u = User(
            phone_or_username=ud["username"],
            display_name=ud["display"],
            avatar_url=ud["avatar"],
            status="online" if ud["username"] in ["alice", "bob"] else "offline"
        )
        db.add(u)
        users.append(u)
    db.commit()

    # Map usernames to users for easy relationship building below
    user_map = {u.phone_or_username: u for u in users}

    # 2. Setup Contacts
    contacts_pairs = [
        ("alice", "bob"), ("alice", "charlie"), ("alice", "david"),
        ("bob", "alice"), ("bob", "eve"),
        ("charlie", "alice"), ("charlie", "frank")
    ]
    for owner_name, contact_name in contacts_pairs:
        # Create a contact relationship
        c = Contact(
            owner_id=user_map[owner_name].id,
            contact_user_id=user_map[contact_name].id
        )
        db.add(c)
    db.commit()

    # 3. Create Direct Conversations
    # Direct Chat 1: Alice & Bob
    conv1 = Conversation(type="direct", last_message_at=datetime.datetime.utcnow() - datetime.timedelta(minutes=5))
    db.add(conv1)
    db.commit()
    db.refresh(conv1)

    m1_alice = ConversationMember(conversation_id=conv1.id, user_id=user_map["alice"].id)
    m1_bob = ConversationMember(conversation_id=conv1.id, user_id=user_map["bob"].id)
    db.add_all([m1_alice, m1_bob])

    # Direct Chat 2: Alice & Charlie
    conv2 = Conversation(type="direct", last_message_at=datetime.datetime.utcnow() - datetime.timedelta(hours=2))
    db.add(conv2)
    db.commit()
    db.refresh(conv2)

    m2_alice = ConversationMember(conversation_id=conv2.id, user_id=user_map["alice"].id)
    m2_charlie = ConversationMember(conversation_id=conv2.id, user_id=user_map["charlie"].id)
    db.add_all([m2_alice, m2_charlie])

    # Direct Chat 3: Bob & Eve
    conv3 = Conversation(type="direct", last_message_at=datetime.datetime.utcnow() - datetime.timedelta(days=1))
    db.add(conv3)
    db.commit()
    db.refresh(conv3)

    m3_bob = ConversationMember(conversation_id=conv3.id, user_id=user_map["bob"].id)
    m3_eve = ConversationMember(conversation_id=conv3.id, user_id=user_map["eve"].id)
    db.add_all([m3_bob, m3_eve])

    # 4. Create Group Conversation
    conv_group = Conversation(
        type="group",
        name="Project Syndicate",
        avatar_url="https://api.dicebear.com/7.x/identicon/svg?seed=Syndicate",
        last_message_at=datetime.datetime.utcnow()
    )
    db.add(conv_group)
    db.commit()
    db.refresh(conv_group)

    # Members of group: Alice (admin), Bob, Charlie, David
    g_alice = ConversationMember(conversation_id=conv_group.id, user_id=user_map["alice"].id, role="admin")
    g_bob = ConversationMember(conversation_id=conv_group.id, user_id=user_map["bob"].id)
    g_charlie = ConversationMember(conversation_id=conv_group.id, user_id=user_map["charlie"].id)
    g_david = ConversationMember(conversation_id=conv_group.id, user_id=user_map["david"].id)
    db.add_all([g_alice, g_bob, g_charlie, g_david])
    db.commit()

    # 5. Seed Messages
    # Alice & Bob chat history with varying timestamps and read statuses
    msg_history_ab = [
        ("bob", "Hey Alice! Are we still on for the project sync?", 60, "read"),
        ("alice", "Yes! Just wrapping up some designs. Give me 10 mins.", 55, "read"),
        ("bob", "Sounds good, I'll prepare the workspace.", 50, "read"),
        ("alice", "Perfect. Did you check the latest API specs?", 45, "read"),
        ("bob", "Yeah, looks super clean. The WebSockets schema fits perfectly.", 40, "read"),
        ("alice", "Great. Let me know if you run into any CORS issues.", 35, "read"),
        ("bob", "Actually, I did notice a configuration gap earlier.", 20, "delivered"),
        ("bob", "I'll show you when we connect.", 5, "sent")
    ]

    last_msg = None
    for sender_name, content, minutes_ago, status in msg_history_ab:
        sender = user_map[sender_name]
        msg = Message(
            conversation_id=conv1.id,
            sender_id=sender.id,
            content=content,
            status=status,
            created_at=datetime.datetime.utcnow() - datetime.timedelta(minutes=minutes_ago)
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        last_msg = msg

        # Write corresponding read/delivery receipts
        recipient = user_map["bob"] if sender_name == "alice" else user_map["alice"]
        if status in ["delivered", "read"]:
            rc = MessageReceipt(
                message_id=msg.id,
                user_id=recipient.id,
                status=status,
                timestamp=msg.created_at + datetime.timedelta(seconds=2)
            )
            db.add(rc)
            db.commit()

    # Set memberships' last read message ID for Alice & Bob
    # Bob has read all up to the one 20 mins ago (which is the 7th message, meaning the last 1 is unread for Bob)
    # Alice has read everything except the last one (which is from Bob, status='sent' or 'delivered')
    # Let's set it simply:
    m1_alice.last_read_message_id = last_msg.id
    # Bob hasn't read the last message
    all_ab_msgs = db.query(Message).filter(Message.conversation_id == conv1.id).order_by(Message.id).all()
    m1_bob.last_read_message_id = all_ab_msgs[-2].id
    db.commit()

    # Group Messages
    msg_history_group = [
        ("alice", "Welcome everyone to the Project Syndicate group!", 120, "read"),
        ("bob", "Hey guys! Glad to be here.", 115, "read"),
        ("charlie", "Hey all!", 110, "read"),
        ("david", "Let's build this clone!", 100, "read"),
        ("alice", "I have added some initial code tasks to our lists.", 90, "read"),
        ("bob", "Cool. I will take on the WebSocket implementation.", 80, "read"),
        ("charlie", "I can work on the database schema setup.", 70, "read"),
        ("david", "And I'll jump on frontend components.", 60, "read"),
        ("alice", "Superb! Let's sync by end of day.", 5, "read")
    ]

    last_group_msg = None
    for sender_name, content, minutes_ago, status in msg_history_group:
        sender = user_map[sender_name]
        msg = Message(
            conversation_id=conv_group.id,
            sender_id=sender.id,
            content=content,
            status=status,
            created_at=datetime.datetime.utcnow() - datetime.timedelta(minutes=minutes_ago)
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        last_group_msg = msg

        # Write receipts for all other group members
        for name in ["alice", "bob", "charlie", "david"]:
            if name != sender_name:
                rc = MessageReceipt(
                    message_id=msg.id,
                    user_id=user_map[name].id,
                    status="read",
                    timestamp=msg.created_at + datetime.timedelta(seconds=5)
                )
                db.add(rc)
        db.commit()

    # Update the high-water marks for group members
    g_alice.last_read_message_id = last_group_msg.id
    g_bob.last_read_message_id = last_group_msg.id
    g_charlie.last_read_message_id = last_group_msg.id
    g_david.last_read_message_id = last_group_msg.id
    db.commit()

    print("Database seeding completed.")
