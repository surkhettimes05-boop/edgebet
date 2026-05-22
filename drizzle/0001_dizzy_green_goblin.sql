CREATE TABLE `adversarial_analysis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`matchId` int NOT NULL,
	`predictionId` int,
	`riskNotes` text NOT NULL,
	`marketWarnings` text,
	`modelWeaknesses` text,
	`uncertaintyFlags` text,
	`analysisType` enum('template_based','llm_generated','mock') NOT NULL DEFAULT 'template_based',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adversarial_analysis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookmakers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`country` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bookmakers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leagues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`country` varchar(100) NOT NULL,
	`season` varchar(20) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leagues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leagueId` int NOT NULL,
	`homeTeamId` int NOT NULL,
	`awayTeamId` int NOT NULL,
	`matchDate` timestamp NOT NULL,
	`status` enum('scheduled','live','completed','cancelled') NOT NULL DEFAULT 'scheduled',
	`homeTeamGoals` int,
	`awayTeamGoals` int,
	`homeTeamXG` decimal(5,2),
	`awayTeamXG` decimal(5,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_predictions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`matchId` int NOT NULL,
	`homeWinProb` decimal(5,4),
	`drawProb` decimal(5,4),
	`awayWinProb` decimal(5,4),
	`confidence` decimal(5,4),
	`evScore` decimal(8,4),
	`predictionOutput` text,
	`riskNotes` text,
	`modelVersion` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `model_predictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `odds_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`matchId` int NOT NULL,
	`bookmakerId` int NOT NULL,
	`homeOdds` decimal(6,3) NOT NULL,
	`drawOdds` decimal(6,3) NOT NULL,
	`awayOdds` decimal(6,3) NOT NULL,
	`timestamp` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `odds_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`leagueId` int NOT NULL,
	`country` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `teams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tracked_bets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`matchId` int NOT NULL,
	`bookmakerId` int NOT NULL,
	`betType` enum('home_win','draw','away_win','over_under','both_to_score') NOT NULL,
	`oddsTaken` decimal(6,3) NOT NULL,
	`stake` decimal(10,2) NOT NULL,
	`evAtEntry` decimal(8,4),
	`result` enum('pending','won','lost','void') NOT NULL DEFAULT 'pending',
	`closingOdds` decimal(6,3),
	`clv` decimal(8,4),
	`pnl` decimal(10,2),
	`isNoBetOverride` int DEFAULT 0,
	`isWarningOverride` int DEFAULT 0,
	`stakeAfterLoss` int DEFAULT 0,
	`rapidBettingFlag` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tracked_bets_id` PRIMARY KEY(`id`)
);
