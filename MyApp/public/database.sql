
create table users (
    name VARCHAR(140) not null,
    access_token varchar(1000) not null,
    refresh_token varchar(1000) not null,
    primary key (name)
);

create table playlists(
    id varchar(100) not null,
    type varchar(20) not null,
    userName varchar(140) not null,
    primary key (id),
    FOREIGN KEY (userName) REFERENCES users(name) ON DELETE CASCADE
);
